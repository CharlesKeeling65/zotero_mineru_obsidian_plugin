"""
Document indexer for RAG service.

This module handles indexing documents from Zotero into the RAG system.
It reads document.json files, extracts chunks, and indexes them into
SQLite, LanceDB, and Tantivy stores.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DocumentIndexer:
    """Document indexer for RAG service."""
    
    def __init__(
        self,
        sqlite_store: Any,
        lancedb_store: Any,
        tantivy_store: Any
    ):
        """Initialize document indexer."""
        self.sqlite_store = sqlite_store
        self.lancedb_store = lancedb_store
        self.tantivy_store = tantivy_store
    
    async def index_document(
        self,
        item_key: str,
        document_path: str,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Index a document from Zotero.
        
        Args:
            item_key: Zotero item key
            document_path: Path to document.json file
            force: Force re-indexing even if already indexed
            
        Returns:
            Indexing result
        """
        try:
            # Check if already indexed
            if not force:
                existing = await self.sqlite_store.get_document(item_key)
                if existing and existing.get("indexed_at"):
                    return {
                        "success": True,
                        "message": f"Document {item_key} already indexed",
                        "item_key": item_key,
                        "chunk_count": existing.get("chunk_count", 0)
                    }
            
            # Read document.json
            if not os.path.exists(document_path):
                raise FileNotFoundError(f"Document file not found: {document_path}")
            
            with open(document_path, "r", encoding="utf-8") as f:
                document_data = json.load(f)
            
            # Extract metadata
            metadata = self._extract_metadata(document_data, item_key)
            
            # Extract blocks
            blocks = self._extract_blocks(document_data, item_key)
            
            # Extract chunks
            chunks = self._extract_chunks(document_data, item_key)
            
            # Store in SQLite
            await self.sqlite_store.add_document(metadata)
            await self.sqlite_store.add_blocks(blocks)
            await self.sqlite_store.add_chunks(chunks)
            
            # Index in Tantivy for BM25
            self.tantivy_store.index_chunks(chunks)
            
            # Index in LanceDB for vector search
            # This would require embedding computation
            # For now, we'll skip vector indexing
            
            # Mark as indexed
            await self.sqlite_store.mark_as_indexed(item_key)
            
            logger.info(f"Indexed document {item_key}: {len(chunks)} chunks")
            
            return {
                "success": True,
                "message": f"Document {item_key} indexed successfully",
                "item_key": item_key,
                "chunk_count": len(chunks),
                "block_count": len(blocks)
            }
            
        except Exception as e:
            logger.error(f"Failed to index document {item_key}: {e}")
            return {
                "success": False,
                "message": f"Failed to index document {item_key}: {str(e)}",
                "item_key": item_key,
                "error": str(e)
            }
    
    async def reindex_document(self, item_key: str) -> Dict[str, Any]:
        """
        Re-index a document.
        
        Args:
            item_key: Zotero item key
            
        Returns:
            Re-indexing result
        """
        try:
            # Get existing document
            existing = await self.sqlite_store.get_document(item_key)
            if not existing:
                return {
                    "success": False,
                    "message": f"Document {item_key} not found",
                    "item_key": item_key
                }
            
            # Delete existing data
            await self.sqlite_store.delete_document(item_key)
            
            # Re-index
            # Note: We need the document path, which we don't have
            # In a real implementation, we'd store the path or find it
            return {
                "success": False,
                "message": f"Re-indexing requires document path",
                "item_key": item_key
            }
            
        except Exception as e:
            logger.error(f"Failed to re-index document {item_key}: {e}")
            return {
                "success": False,
                "message": f"Failed to re-index document {item_key}: {str(e)}",
                "item_key": item_key,
                "error": str(e)
            }
    
    def _extract_metadata(self, document_data: Dict[str, Any], item_key: str) -> Dict[str, Any]:
        """Extract metadata from document data."""
        # Extract from the document structure
        document = document_data.get("document", {})
        source = document.get("source", {})
        parse = document.get("parse", {})
        stats = document.get("stats", {})
        
        return {
            "item_key": item_key,
            "title": document.get("title", source.get("title", "")),
            "authors": json.dumps(source.get("authors", [])),
            "year": source.get("year"),
            "doi": source.get("doi"),
            "pdf_attachment_key": source.get("pdf_attachment_key"),
            "pdf_path": source.get("pdf_path"),
            "parse_engine": parse.get("engine", "mineru"),
            "parse_time": parse.get("parsedAt"),
            "block_count": stats.get("blockCount", 0),
            "chunk_count": stats.get("chunkCount", 0),
            "asset_count": stats.get("assetCount", 0),
            "source_hash": source.get("source_hash"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    
    def _extract_blocks(self, document_data: Dict[str, Any], item_key: str) -> List[Dict[str, Any]]:
        """Extract blocks from document data."""
        blocks = document_data.get("blocks", [])
        extracted_blocks = []
        
        for block in blocks:
            extracted_blocks.append({
                "block_id": block.get("blockId"),
                "document_id": block.get("documentId"),
                "item_key": item_key,
                "type": block.get("type"),
                "core_section": block.get("coreSection"),
                "subtype": block.get("subtype"),
                "section_path": json.dumps(block.get("sectionPath", [])),
                "page_start": block.get("pageRange", {}).get("start"),
                "page_end": block.get("pageRange", {}).get("end"),
                "order_index": block.get("order"),
                "content_text": block.get("content", {}).get("text"),
                "content_markdown": block.get("content", {}).get("markdown"),
                "caption": block.get("caption"),
                "asset_ids": json.dumps(block.get("assetIds", [])),
                "related_block_ids": json.dumps(block.get("relatedBlockIds", [])),
                "tags": json.dumps(block.get("tags", [])),
                "source_fingerprint": block.get("sourceFingerprint"),
                "created_at": datetime.now().isoformat()
            })
        
        return extracted_blocks
    
    def _extract_chunks(self, document_data: Dict[str, Any], item_key: str) -> List[Dict[str, Any]]:
        """Extract chunks from document data."""
        chunks = document_data.get("chunks", [])
        extracted_chunks = []
        
        for chunk in chunks:
            # Extract context information
            context = chunk.get("context", {})
            metadata = chunk.get("metadata", {})
            
            extracted_chunks.append({
                "chunk_id": chunk.get("chunkId"),
                "item_key": item_key,
                "document_id": chunk.get("documentId"),
                "block_id": chunk.get("blockId"),
                "chunk_level": chunk.get("chunkLevel", "paragraph"),
                "text": chunk.get("text", ""),
                "content_markdown": chunk.get("contentMarkdown"),
                "context_before": context.get("before"),
                "context_after": context.get("after"),
                "section": context.get("section"),
                "subsection": context.get("subsection"),
                "section_path": json.dumps(context.get("sectionPath", [])),
                "block_type": metadata.get("blockType"),
                "subtype": metadata.get("subtype"),
                "page_start": metadata.get("pageStart"),
                "page_end": metadata.get("pageEnd"),
                "order_index": metadata.get("order"),
                "token_count": metadata.get("tokenCount"),
                "text_hash": metadata.get("textHash"),
                "created_at": metadata.get("createdAt", datetime.now().isoformat()),
                "embedding_model": metadata.get("embeddingModel"),
                "embedding": None  # Embeddings computed separately
            })
        
        return extracted_chunks