"""
Context Expander for RAG Service

This module provides context expansion functionality for enriching
search results with surrounding context and related information.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ContextExpander:
    """Context expander for enriching search results."""
    
    def __init__(self, sqlite_store: Any):
        """Initialize context expander."""
        self.sqlite_store = sqlite_store
    
    async def expand_context(
        self,
        chunk_id: str,
        include_before: bool = True,
        include_after: bool = True,
        include_section: bool = True,
        include_related: bool = True,
        context_window: int = 2
    ) -> Dict[str, Any]:
        """
        Expand context for a chunk.
        
        Args:
            chunk_id: Chunk ID to expand
            include_before: Include preceding chunks
            include_after: Include following chunks
            include_section: Include section information
            include_related: Include related chunks
            context_window: Number of chunks to include before/after
            
        Returns:
            Expanded context
        """
        try:
            # Get the target chunk
            chunk = await self.sqlite_store.get_chunk(chunk_id)
            if not chunk:
                return {"error": f"Chunk {chunk_id} not found"}
            
            # Initialize result
            result = {
                "chunk_id": chunk_id,
                "chunk": chunk,
                "context": {}
            }
            
            # Get item key and order index
            item_key = chunk["item_key"]
            order_index = chunk["order_index"]
            
            # Get preceding chunks
            if include_before:
                preceding_chunks = await self._get_preceding_chunks(
                    item_key, order_index, context_window
                )
                result["context"]["before"] = preceding_chunks
            
            # Get following chunks
            if include_after:
                following_chunks = await self._get_following_chunks(
                    item_key, order_index, context_window
                )
                result["context"]["after"] = following_chunks
            
            # Get section information
            if include_section:
                section_info = await self._get_section_info(
                    item_key, chunk.get("section")
                )
                result["context"]["section"] = section_info
            
            # Get related chunks
            if include_related:
                related_chunks = await self._get_related_chunks(
                    item_key, chunk_id
                )
                result["context"]["related"] = related_chunks
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to expand context for chunk {chunk_id}: {e}")
            return {"error": str(e)}
    
    async def _get_preceding_chunks(
        self,
        item_key: str,
        order_index: int,
        count: int
    ) -> List[Dict[str, Any]]:
        """Get preceding chunks."""
        try:
            # Get chunks with lower order index
            chunks = await self.sqlite_store.search_chunks(
                query="",
                item_keys=[item_key],
                limit=count
            )
            
            # Filter and sort by order index
            preceding = [
                chunk for chunk in chunks
                if chunk["order_index"] < order_index
            ]
            
            # Sort by order index descending (closest first)
            preceding.sort(key=lambda x: x["order_index"], reverse=True)
            
            return preceding[:count]
            
        except Exception as e:
            logger.error(f"Failed to get preceding chunks: {e}")
            return []
    
    async def _get_following_chunks(
        self,
        item_key: str,
        order_index: int,
        count: int
    ) -> List[Dict[str, Any]]:
        """Get following chunks."""
        try:
            # Get chunks with higher order index
            chunks = await self.sqlite_store.search_chunks(
                query="",
                item_keys=[item_key],
                limit=count * 2  # Get more to filter
            )
            
            # Filter and sort by order index
            following = [
                chunk for chunk in chunks
                if chunk["order_index"] > order_index
            ]
            
            # Sort by order index ascending (closest first)
            following.sort(key=lambda x: x["order_index"])
            
            return following[:count]
            
        except Exception as e:
            logger.error(f"Failed to get following chunks: {e}")
            return []
    
    async def _get_section_info(
        self,
        item_key: str,
        section: Optional[str]
    ) -> Dict[str, Any]:
        """Get section information."""
        try:
            if not section:
                return {}
            
            # Get all chunks in the same section
            chunks = await self.sqlite_store.search_chunks(
                query="",
                item_keys=[item_key],
                section=[section]
            )
            
            # Get section statistics
            total_chunks = len(chunks)
            total_tokens = sum(chunk.get("token_count", 0) for chunk in chunks)
            
            return {
                "section": section,
                "total_chunks": total_chunks,
                "total_tokens": total_tokens,
                "chunk_ids": [chunk["chunk_id"] for chunk in chunks]
            }
            
        except Exception as e:
            logger.error(f"Failed to get section info: {e}")
            return {}
    
    async def _get_related_chunks(
        self,
        item_key: str,
        chunk_id: str
    ) -> List[Dict[str, Any]]:
        """Get related chunks."""
        try:
            # This is a simplified implementation
            # In reality, we'd use more sophisticated relation detection
            
            # Get chunks from the same item
            chunks = await self.sqlite_store.search_chunks(
                query="",
                item_keys=[item_key],
                limit=10
            )
            
            # Filter out the current chunk
            related = [
                chunk for chunk in chunks
                if chunk["chunk_id"] != chunk_id
            ]
            
            return related[:5]  # Return top 5 related chunks
            
        except Exception as e:
            logger.error(f"Failed to get related chunks: {e}")
            return []
    
    async def expand_multiple_chunks(
        self,
        chunk_ids: List[str],
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Expand context for multiple chunks."""
        results = []
        
        for chunk_id in chunk_ids:
            expanded = await self.expand_context(chunk_id, **kwargs)
            results.append(expanded)
        
        return results


class ContextWindow:
    """Context window for managing context expansion."""
    
    def __init__(
        self,
        target_chunk: Dict[str, Any],
        before_chunks: List[Dict[str, Any]],
        after_chunks: List[Dict[str, Any]],
        section_info: Optional[Dict[str, Any]] = None,
        related_chunks: Optional[List[Dict[str, Any]]] = None
    ):
        """Initialize context window."""
        self.target_chunk = target_chunk
        self.before_chunks = before_chunks
        self.after_chunks = after_chunks
        self.section_info = section_info
        self.related_chunks = related_chunks or []
    
    def get_full_context(self) -> str:
        """Get full context as text."""
        parts = []
        
        # Add before context
        for chunk in self.before_chunks:
            parts.append(chunk.get("text", ""))
        
        # Add target chunk
        parts.append(self.target_chunk.get("text", ""))
        
        # Add after context
        for chunk in self.after_chunks:
            parts.append(chunk.get("text", ""))
        
        return "\n\n".join(parts)
    
    def get_context_summary(self) -> Dict[str, Any]:
        """Get context summary."""
        return {
            "target_chunk_id": self.target_chunk.get("chunk_id"),
            "before_count": len(self.before_chunks),
            "after_count": len(self.after_chunks),
            "related_count": len(self.related_chunks),
            "section": self.section_info.get("section") if self.section_info else None,
            "total_tokens": self._calculate_total_tokens()
        }
    
    def _calculate_total_tokens(self) -> int:
        """Calculate total tokens in context window."""
        total = 0
        
        # Add before chunks
        for chunk in self.before_chunks:
            total += chunk.get("token_count", 0)
        
        # Add target chunk
        total += self.target_chunk.get("token_count", 0)
        
        # Add after chunks
        for chunk in self.after_chunks:
            total += chunk.get("token_count", 0)
        
        return total


def create_context_window(
    target_chunk: Dict[str, Any],
    before_chunks: List[Dict[str, Any]],
    after_chunks: List[Dict[str, Any]],
    section_info: Optional[Dict[str, Any]] = None,
    related_chunks: Optional[List[Dict[str, Any]]] = None
) -> ContextWindow:
    """Create a context window."""
    return ContextWindow(
        target_chunk=target_chunk,
        before_chunks=before_chunks,
        after_chunks=after_chunks,
        section_info=section_info,
        related_chunks=related_chunks
    )