"""
Retrieval layer for RAG service.

This module provides retrieval implementations for searching and ranking chunks.
"""

from .hybrid_retriever import HybridRetriever

__all__ = ["HybridRetriever"]