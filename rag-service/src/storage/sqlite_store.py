"""
SQLite storage layer for RAG service.

This module provides SQLite-based storage for documents, chunks, and metadata.
It uses SQLAlchemy for database operations and aiosqlite for async support.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import aiosqlite
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)


class SQLiteStore:
    """SQLite storage for RAG service."""
    
    def __init__(self, db_path: str):
        """Initialize SQLite store."""
        self.db_path = db_path
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        
        # Initialize database
        self._initialize_db()
    
    def _initialize_db(self):
        """Initialize database tables."""
        # Create synchronous engine for initialization
        sync_engine = create_engine(f"sqlite:///{self.db_path}")
        
        with sync_engine.connect() as conn:
            # Create documents table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS documents (
                    item_key TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    authors TEXT,
                    year INTEGER,
                    doi TEXT,
                    pdf_attachment_key TEXT,
                    pdf_path TEXT,
                    parse_engine TEXT,
                    parse_time TEXT,
                    block_count INTEGER,
                    chunk_count INTEGER,
                    asset_count INTEGER,
                    source_hash TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    indexed_at TEXT
                )
            """))
            
            # Create chunks table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS chunks (
                    chunk_id TEXT PRIMARY KEY,
                    item_key TEXT NOT NULL,
                    document_id TEXT NOT NULL,
                    block_id TEXT NOT NULL,
                    chunk_level TEXT NOT NULL,
                    text TEXT NOT NULL,
                    content_markdown TEXT,
                    context_before TEXT,
                    context_after TEXT,
                    section TEXT,
                    subsection TEXT,
                    section_path TEXT,
                    block_type TEXT,
                    subtype TEXT,
                    page_start INTEGER,
                    page_end INTEGER,
                    order_index INTEGER,
                    token_count INTEGER,
                    text_hash TEXT,
                    created_at TEXT,
                    embedding_model TEXT,
                    embedding BLOB,
                    FOREIGN KEY (item_key) REFERENCES documents (item_key)
                )
            """))
            
            # Create blocks table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS blocks (
                    block_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    item_key TEXT NOT NULL,
                    type TEXT NOT NULL,
                    core_section TEXT,
                    subtype TEXT,
                    section_path TEXT,
                    page_start INTEGER,
                    page_end INTEGER,
                    order_index INTEGER,
                    content_text TEXT,
                    content_markdown TEXT,
                    caption TEXT,
                    asset_ids TEXT,
                    related_block_ids TEXT,
                    tags TEXT,
                    source_fingerprint TEXT,
                    created_at TEXT,
                    FOREIGN KEY (item_key) REFERENCES documents (item_key)
                )
            """))
            
            # Create assets table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS assets (
                    asset_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    item_key TEXT NOT NULL,
                    type TEXT NOT NULL,
                    filename TEXT,
                    path TEXT,
                    mime_type TEXT,
                    size INTEGER,
                    created_at TEXT,
                    FOREIGN KEY (item_key) REFERENCES documents (item_key)
                )
            """))
            
            # Create relations table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS relations (
                    relation_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    source_block_id TEXT NOT NULL,
                    target_block_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    confidence REAL,
                    provenance TEXT,
                    created_at TEXT
                )
            """))
            
            # Create indexes
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunks_item_key ON chunks (item_key)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunks_block_id ON chunks (block_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks (section)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunks_block_type ON chunks (block_type)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_blocks_item_key ON blocks (item_key)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_documents_indexed_at ON documents (indexed_at)
            """))
            
            conn.commit()
        
        sync_engine.dispose()
    
    async def add_document(self, document: Dict[str, Any]) -> bool:
        """Add or update a document."""
        try:
            async with self.async_session() as session:
                # Check if document exists
                result = await session.execute(
                    text("SELECT item_key FROM documents WHERE item_key = :item_key"),
                    {"item_key": document["item_key"]}
                )
                existing = result.fetchone()
                
                if existing:
                    # Update existing document
                    await session.execute(
                        text("""
                            UPDATE documents SET
                                title = :title,
                                authors = :authors,
                                year = :year,
                                doi = :doi,
                                pdf_attachment_key = :pdf_attachment_key,
                                pdf_path = :pdf_path,
                                parse_engine = :parse_engine,
                                parse_time = :parse_time,
                                block_count = :block_count,
                                chunk_count = :chunk_count,
                                asset_count = :asset_count,
                                source_hash = :source_hash,
                                updated_at = :updated_at
                            WHERE item_key = :item_key
                        """),
                        document
                    )
                else:
                    # Insert new document
                    await session.execute(
                        text("""
                            INSERT INTO documents (
                                item_key, title, authors, year, doi,
                                pdf_attachment_key, pdf_path, parse_engine,
                                parse_time, block_count, chunk_count,
                                asset_count, source_hash, created_at, updated_at
                            ) VALUES (
                                :item_key, :title, :authors, :year, :doi,
                                :pdf_attachment_key, :pdf_path, :parse_engine,
                                :parse_time, :block_count, :chunk_count,
                                :asset_count, :source_hash, :created_at, :updated_at
                            )
                        """),
                        document
                    )
                
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            return False
    
    async def add_chunks(self, chunks: List[Dict[str, Any]]) -> bool:
        """Add or update chunks."""
        try:
            async with self.async_session() as session:
                for chunk in chunks:
                    # Check if chunk exists
                    result = await session.execute(
                        text("SELECT chunk_id FROM chunks WHERE chunk_id = :chunk_id"),
                        {"chunk_id": chunk["chunk_id"]}
                    )
                    existing = result.fetchone()
                    
                    if existing:
                        # Update existing chunk
                        await session.execute(
                            text("""
                                UPDATE chunks SET
                                    item_key = :item_key,
                                    document_id = :document_id,
                                    block_id = :block_id,
                                    chunk_level = :chunk_level,
                                    text = :text,
                                    content_markdown = :content_markdown,
                                    context_before = :context_before,
                                    context_after = :context_after,
                                    section = :section,
                                    subsection = :subsection,
                                    section_path = :section_path,
                                    block_type = :block_type,
                                    subtype = :subtype,
                                    page_start = :page_start,
                                    page_end = :page_end,
                                    order_index = :order_index,
                                    token_count = :token_count,
                                    text_hash = :text_hash,
                                    created_at = :created_at,
                                    embedding_model = :embedding_model,
                                    embedding = :embedding
                                WHERE chunk_id = :chunk_id
                            """),
                            chunk
                        )
                    else:
                        # Insert new chunk
                        await session.execute(
                            text("""
                                INSERT INTO chunks (
                                    chunk_id, item_key, document_id, block_id,
                                    chunk_level, text, content_markdown,
                                    context_before, context_after, section,
                                    subsection, section_path, block_type, subtype,
                                    page_start, page_end, order_index, token_count,
                                    text_hash, created_at, embedding_model, embedding
                                ) VALUES (
                                    :chunk_id, :item_key, :document_id, :block_id,
                                    :chunk_level, :text, :content_markdown,
                                    :context_before, :context_after, :section,
                                    :subsection, :section_path, :block_type, :subtype,
                                    :page_start, :page_end, :order_index, :token_count,
                                    :text_hash, :created_at, :embedding_model, :embedding
                                )
                            """),
                            chunk
                        )
                
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to add chunks: {e}")
            return False
    
    async def add_blocks(self, blocks: List[Dict[str, Any]]) -> bool:
        """Add or update blocks."""
        try:
            async with self.async_session() as session:
                for block in blocks:
                    # Check if block exists
                    result = await session.execute(
                        text("SELECT block_id FROM blocks WHERE block_id = :block_id"),
                        {"block_id": block["block_id"]}
                    )
                    existing = result.fetchone()
                    
                    if existing:
                        # Update existing block
                        await session.execute(
                            text("""
                                UPDATE blocks SET
                                    document_id = :document_id,
                                    item_key = :item_key,
                                    type = :type,
                                    core_section = :core_section,
                                    subtype = :subtype,
                                    section_path = :section_path,
                                    page_start = :page_start,
                                    page_end = :page_end,
                                    order_index = :order_index,
                                    content_text = :content_text,
                                    content_markdown = :content_markdown,
                                    caption = :caption,
                                    asset_ids = :asset_ids,
                                    related_block_ids = :related_block_ids,
                                    tags = :tags,
                                    source_fingerprint = :source_fingerprint,
                                    created_at = :created_at
                                WHERE block_id = :block_id
                            """),
                            block
                        )
                    else:
                        # Insert new block
                        await session.execute(
                            text("""
                                INSERT INTO blocks (
                                    block_id, document_id, item_key, type,
                                    core_section, subtype, section_path,
                                    page_start, page_end, order_index,
                                    content_text, content_markdown, caption,
                                    asset_ids, related_block_ids, tags,
                                    source_fingerprint, created_at
                                ) VALUES (
                                    :block_id, :document_id, :item_key, :type,
                                    :core_section, :subtype, :section_path,
                                    :page_start, :page_end, :order_index,
                                    :content_text, :content_markdown, :caption,
                                    :asset_ids, :related_block_ids, :tags,
                                    :source_fingerprint, :created_at
                                )
                            """),
                            block
                        )
                
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to add blocks: {e}")
            return False
    
    async def get_document(self, item_key: str) -> Optional[Dict[str, Any]]:
        """Get document by item key."""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    text("SELECT * FROM documents WHERE item_key = :item_key"),
                    {"item_key": item_key}
                )
                row = result.fetchone()
                
                if row:
                    return dict(row._mapping)
                return None
        except Exception as e:
            logger.error(f"Failed to get document: {e}")
            return None
    
    async def get_chunk(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Get chunk by ID."""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    text("SELECT * FROM chunks WHERE chunk_id = :chunk_id"),
                    {"chunk_id": chunk_id}
                )
                row = result.fetchone()
                
                if row:
                    chunk = dict(row._mapping)
                    # Parse JSON fields
                    if chunk.get("section_path"):
                        chunk["section_path"] = json.loads(chunk["section_path"])
                    return chunk
                return None
        except Exception as e:
            logger.error(f"Failed to get chunk: {e}")
            return None
    
    async def get_chunks_by_item(self, item_key: str) -> List[Dict[str, Any]]:
        """Get all chunks for an item."""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    text("SELECT * FROM chunks WHERE item_key = :item_key ORDER BY order_index"),
                    {"item_key": item_key}
                )
                rows = result.fetchall()
                
                chunks = []
                for row in rows:
                    chunk = dict(row._mapping)
                    # Parse JSON fields
                    if chunk.get("section_path"):
                        chunk["section_path"] = json.loads(chunk["section_path"])
                    chunks.append(chunk)
                
                return chunks
        except Exception as e:
            logger.error(f"Failed to get chunks: {e}")
            return []
    
    async def get_document_blocks(
        self, 
        item_key: str, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get blocks for a document."""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT * FROM blocks 
                        WHERE item_key = :item_key 
                        ORDER BY order_index 
                        LIMIT :limit OFFSET :offset
                    """),
                    {"item_key": item_key, "limit": limit, "offset": offset}
                )
                rows = result.fetchall()
                
                blocks = []
                for row in rows:
                    block = dict(row._mapping)
                    # Parse JSON fields
                    for field in ["section_path", "asset_ids", "related_block_ids", "tags"]:
                        if block.get(field):
                            block[field] = json.loads(block[field])
                    blocks.append(block)
                
                return blocks
        except Exception as e:
            logger.error(f"Failed to get document blocks: {e}")
            return []
    
    async def search_chunks(
        self,
        query: str,
        item_keys: Optional[List[str]] = None,
        section: Optional[List[str]] = None,
        block_type: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Search chunks by text content."""
        try:
            async with self.async_session() as session:
                # Build query
                sql = "SELECT * FROM chunks WHERE 1=1"
                params = {}
                
                # Add text search
                if query:
                    sql += " AND text LIKE :query"
                    params["query"] = f"%{query}%"
                
                # Add filters
                if item_keys:
                    placeholders = ", ".join([f":item_key_{i}" for i in range(len(item_keys))])
                    sql += f" AND item_key IN ({placeholders})"
                    for i, key in enumerate(item_keys):
                        params[f"item_key_{i}"] = key
                
                if section:
                    placeholders = ", ".join([f":section_{i}" for i in range(len(section))])
                    sql += f" AND section IN ({placeholders})"
                    for i, sec in enumerate(section):
                        params[f"section_{i}"] = sec
                
                if block_type:
                    placeholders = ", ".join([f":block_type_{i}" for i in range(len(block_type))])
                    sql += f" AND block_type IN ({placeholders})"
                    for i, bt in enumerate(block_type):
                        params[f"block_type_{i}"] = bt
                
                sql += " ORDER BY order_index LIMIT :limit"
                params["limit"] = limit
                
                result = await session.execute(text(sql), params)
                rows = result.fetchall()
                
                chunks = []
                for row in rows:
                    chunk = dict(row._mapping)
                    # Parse JSON fields
                    if chunk.get("section_path"):
                        chunk["section_path"] = json.loads(chunk["section_path"])
                    chunks.append(chunk)
                
                return chunks
        except Exception as e:
            logger.error(f"Failed to search chunks: {e}")
            return []
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics."""
        try:
            async with self.async_session() as session:
                # Get document count
                result = await session.execute(text("SELECT COUNT(*) FROM documents"))
                doc_count = result.scalar()
                
                # Get chunk count
                result = await session.execute(text("SELECT COUNT(*) FROM chunks"))
                chunk_count = result.scalar()
                
                # Get block count
                result = await session.execute(text("SELECT COUNT(*) FROM blocks"))
                block_count = result.scalar()
                
                # Get indexed document count
                result = await session.execute(
                    text("SELECT COUNT(*) FROM documents WHERE indexed_at IS NOT NULL")
                )
                indexed_count = result.scalar()
                
                return {
                    "documents": doc_count,
                    "chunks": chunk_count,
                    "blocks": block_count,
                    "indexed_documents": indexed_count
                }
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}
    
    async def get_unindexed_items(self) -> List[Dict[str, Any]]:
        """Get items that haven't been indexed yet."""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT item_key, title, pdf_path 
                        FROM documents 
                        WHERE indexed_at IS NULL
                        ORDER BY created_at DESC
                    """)
                )
                rows = result.fetchall()
                
                return [dict(row._mapping) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get unindexed items: {e}")
            return []
    
    async def mark_as_indexed(self, item_key: str) -> bool:
        """Mark a document as indexed."""
        try:
            async with self.async_session() as session:
                await session.execute(
                    text("""
                        UPDATE documents 
                        SET indexed_at = :indexed_at 
                        WHERE item_key = :item_key
                    """),
                    {
                        "item_key": item_key,
                        "indexed_at": datetime.now().isoformat()
                    }
                )
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to mark as indexed: {e}")
            return False
    
    async def delete_document(self, item_key: str) -> bool:
        """Delete a document and all its chunks."""
        try:
            async with self.async_session() as session:
                # Delete chunks
                await session.execute(
                    text("DELETE FROM chunks WHERE item_key = :item_key"),
                    {"item_key": item_key}
                )
                
                # Delete blocks
                await session.execute(
                    text("DELETE FROM blocks WHERE item_key = :item_key"),
                    {"item_key": item_key}
                )
                
                # Delete document
                await session.execute(
                    text("DELETE FROM documents WHERE item_key = :item_key"),
                    {"item_key": item_key}
                )
                
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            return False