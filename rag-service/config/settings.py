"""
Configuration settings for RAG service.

This module provides configuration management for the RAG service,
including database paths, embedding models, and service settings.
"""

import os
from typing import Optional
from pydantic import BaseSettings, Field


class RAGSettings(BaseSettings):
    """RAG service configuration."""
    
    # Service settings
    host: str = Field(default="0.0.0.0", description="Service host")
    port: int = Field(default=8765, description="Service port")
    debug: bool = Field(default=False, description="Debug mode")
    
    # Database settings
    db_path: str = Field(
        default="./data/rag.db",
        description="SQLite database path"
    )
    lancedb_path: str = Field(
        default="./data/lancedb",
        description="LanceDB database path"
    )
    tantivy_path: str = Field(
        default="./data/tantivy",
        description="Tantivy index path"
    )
    
    # Embedding settings
    embedding_model: str = Field(
        default="BAAI/bge-m3",
        description="Embedding model name"
    )
    embedding_dimension: int = Field(
        default=1024,
        description="Embedding dimension"
    )
    
    # Retrieval settings
    bm25_weight: float = Field(
        default=0.4,
        description="BM25 weight in hybrid retrieval"
    )
    vector_weight: float = Field(
        default=0.6,
        description="Vector weight in hybrid retrieval"
    )
    reranker_model: Optional[str] = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2",
        description="Reranker model name"
    )
    
    # Chunk settings
    max_chunk_tokens: int = Field(
        default=512,
        description="Maximum tokens per chunk"
    )
    min_chunk_tokens: int = Field(
        default=50,
        description="Minimum tokens per chunk"
    )
    chunk_overlap_tokens: int = Field(
        default=50,
        description="Chunk overlap tokens"
    )
    
    # Zotero settings
    zotero_mcp_url: Optional[str] = Field(
        default=None,
        description="Zotero MCP server URL"
    )
    
    # Logging settings
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )
    log_file: Optional[str] = Field(
        default=None,
        description="Log file path"
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_prefix = "RAG_"


def get_settings() -> RAGSettings:
    """Get RAG settings."""
    return RAGSettings()


# Global settings instance
settings = get_settings()


# Environment-specific overrides
if os.getenv("RAG_ENV") == "development":
    settings.debug = True
    settings.log_level = "DEBUG"
elif os.getenv("RAG_ENV") == "production":
    settings.debug = False
    settings.log_level = "WARNING"


# Create data directories if they don't exist
os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
os.makedirs(settings.lancedb_path, exist_ok=True)
os.makedirs(settings.tantivy_path, exist_ok=True)