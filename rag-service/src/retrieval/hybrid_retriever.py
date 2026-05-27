"""
Hybrid retriever for RAG service.

This module implements hybrid retrieval combining BM25 and vector search,
with optional reranking for improved accuracy.

Retrieval Pipeline:
1. Metadata filtering
2. BM25 + Vector hybrid recall
3. Cross-encoder reranking
4. Context expansion
5. Evidence pack output
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class HybridRetriever:
    """Hybrid retriever combining BM25 and vector search."""
    
    def __init__(
        self,
        sqlite_store: Any,
        lancedb_store: Any,
        tantivy_store: Any,
        embedding_model: str = "BAAI/bge-m3"
    ):
        """Initialize hybrid retriever."""
        self.sqlite_store = sqlite_store
        self.lancedb_store = lancedb_store
        self.tantivy_store = tantivy_store
        self.embedding_model = embedding_model
        
        # Reranker (optional)
        self.reranker = None
        
        # Try to load reranker
        try:
            from sentence_transformers import CrossEncoder
            self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
            logger.info("Loaded cross-encoder reranker")
        except Exception as e:
            logger.warning(f"Failed to load reranker: {e}")
    
    async def search(
        self,
        query: str,
        item_keys: Optional[List[str]] = None,
        section: Optional[List[str]] = None,
        block_type: Optional[List[str]] = None,
        top_k: int = 10,
        include_context: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search for passages using hybrid retrieval.
        
        Args:
            query: Search query
            item_keys: Filter by item keys
            section: Filter by section
            block_type: Filter by block type
            top_k: Number of results to return
            include_context: Include context in results
            
        Returns:
            List of search results with scores and context
        """
        try:
            # Step 1: BM25 search
            bm25_results = await self._bm25_search(
                query=query,
                item_keys=item_keys,
                section=section,
                block_type=block_type,
                limit=top_k * 2  # Get more candidates for reranking
            )
            
            # Step 2: Vector search
            vector_results = await self._vector_search(
                query=query,
                item_keys=item_keys,
                section=section,
                block_type=block_type,
                limit=top_k * 2
            )
            
            # Step 3: Merge results
            merged_results = self._merge_results(bm25_results, vector_results)
            
            # Step 4: Rerank if available
            if self.reranker and len(merged_results) > top_k:
                reranked_results = self._rerank_results(query, merged_results, top_k)
            else:
                reranked_results = merged_results[:top_k]
            
            # Step 5: Add context if requested
            if include_context:
                for result in reranked_results:
                    context = await self._get_context_for_chunk(result["chunk_id"])
                    result["context"] = context
            
            return reranked_results
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    async def _bm25_search(
        self,
        query: str,
        item_keys: Optional[List[str]] = None,
        section: Optional[List[str]] = None,
        block_type: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Perform BM25 search using Tantivy."""
        try:
            # Search using Tantivy
            results = self.tantivy_store.search(
                query=query,
                item_keys=item_keys,
                section=section,
                block_type=block_type,
                limit=limit
            )
            
            # Convert to standard format
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "chunk_id": result["chunk_id"],
                    "item_key": result["item_key"],
                    "block_id": result["block_id"],
                    "text": result["text"],
                    "score": result["score"],
                    "retrieval_source": "bm25",
                    "bm25_score": result["score"],
                    "vector_score": None,
                    "rerank_score": None
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            return []
    
    async def _vector_search(
        self,
        query: str,
        item_keys: Optional[List[str]] = None,
        section: Optional[List[str]] = None,
        block_type: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Perform vector search using LanceDB."""
        try:
            # Get query embedding
            query_embedding = await self._get_embedding(query)
            
            # Search using LanceDB
            results = self.lancedb_store.search(
                query_embedding=query_embedding,
                item_keys=item_keys,
                section=section,
                block_type=block_type,
                limit=limit
            )
            
            # Convert to standard format
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "chunk_id": result["chunk_id"],
                    "item_key": result["item_key"],
                    "block_id": result["block_id"],
                    "text": result["text"],
                    "score": result["score"],
                    "retrieval_source": "vector",
                    "bm25_score": None,
                    "vector_score": result["score"],
                    "rerank_score": None
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
    
    def _merge_results(
        self,
        bm25_results: List[Dict[str, Any]],
        vector_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge BM25 and vector search results."""
        # Create a dictionary to store merged results
        merged = {}
        
        # Add BM25 results
        for result in bm25_results:
            chunk_id = result["chunk_id"]
            if chunk_id not in merged:
                merged[chunk_id] = result.copy()
                merged[chunk_id]["scores"] = {
                    "bm25": result["score"],
                    "vector": 0.0
                }
            else:
                merged[chunk_id]["scores"]["bm25"] = result["score"]
        
        # Add vector results
        for result in vector_results:
            chunk_id = result["chunk_id"]
            if chunk_id not in merged:
                merged[chunk_id] = result.copy()
                merged[chunk_id]["scores"] = {
                    "bm25": 0.0,
                    "vector": result["score"]
                }
            else:
                merged[chunk_id]["scores"]["vector"] = result["score"]
        
        # Calculate combined scores
        for chunk_id, result in merged.items():
            scores = result["scores"]
            # Weighted combination: 0.4 BM25 + 0.6 Vector
            combined_score = 0.4 * scores["bm25"] + 0.6 * scores["vector"]
            result["score"] = combined_score
            result["bm25_score"] = scores["bm25"]
            result["vector_score"] = scores["vector"]
            result["retrieval_source"] = "hybrid"
            del result["scores"]
        
        # Sort by combined score
        results = list(merged.values())
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return results
    
    def _rerank_results(
        self,
        query: str,
        results: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Rerank results using cross-encoder."""
        try:
            if not self.reranker:
                return results[:top_k]
            
            # Prepare pairs for reranking
            pairs = []
            for result in results:
                pairs.append([query, result["text"]])
            
            # Get reranker scores
            scores = self.reranker.predict(pairs)
            
            # Add rerank scores to results
            for i, result in enumerate(results):
                result["rerank_score"] = float(scores[i])
                result["score"] = float(scores[i])
                result["retrieval_source"] = "rerank"
            
            # Sort by rerank score
            results.sort(key=lambda x: x["rerank_score"], reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return results[:top_k]
    
    async def _get_context_for_chunk(self, chunk_id: str) -> Dict[str, str]:
        """Get context for a chunk."""
        try:
            # Get chunk from SQLite
            chunk = await self.sqlite_store.get_chunk(chunk_id)
            if not chunk:
                return {"before": "", "after": "", "section": ""}
            
            return {
                "before": chunk.get("context_before", ""),
                "after": chunk.get("context_after", ""),
                "section": chunk.get("section", ""),
                "subsection": chunk.get("subsection", "")
            }
            
        except Exception as e:
            logger.error(f"Failed to get context for chunk {chunk_id}: {e}")
            return {"before": "", "after": "", "section": ""}
    
    async def get_chunk_with_context(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Get chunk with surrounding context."""
        try:
            # Get chunk from SQLite
            chunk = await self.sqlite_store.get_chunk(chunk_id)
            if not chunk:
                return None
            
            # Get context
            context = await self._get_context_for_chunk(chunk_id)
            
            # Get surrounding chunks
            item_key = chunk["item_key"]
            order_index = chunk["order_index"]
            
            # Get previous chunk
            prev_chunk = None
            if order_index > 0:
                prev_chunks = await self.sqlite_store.search_chunks(
                    query="",
                    item_keys=[item_key],
                    limit=1
                )
                # This is simplified; in reality we'd need to get by order
                if prev_chunks:
                    prev_chunk = prev_chunks[0]
            
            # Get next chunk
            next_chunk = None
            # This is simplified; in reality we'd need to get by order
            
            return {
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "context": {
                    "before": prev_chunk["text"] if prev_chunk else "",
                    "after": next_chunk["text"] if next_chunk else "",
                    "section": chunk.get("section", ""),
                    "subsection": chunk.get("subsection", "")
                },
                "metadata": {
                    "item_key": chunk["item_key"],
                    "block_id": chunk["block_id"],
                    "block_type": chunk["block_type"],
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "order_index": chunk["order_index"]
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get chunk with context: {e}")
            return None
    
    async def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text."""
        try:
            # This is a simplified implementation
            # In reality, we'd use the embedding model
            # For now, return a dummy embedding
            return [0.0] * 1024  # BGE-M3 produces 1024-dimensional embeddings
        except Exception as e:
            logger.error(f"Failed to get embedding: {e}")
            return [0.0] * 1024