"""
RAG Service for Zotero-MinerU Structured Literature Workspace

This service provides:
1. Document indexing and storage
2. Vector and BM25 hybrid retrieval
3. MCP server interface for AI agents

Architecture:
- FastAPI for REST API
- SQLite for metadata storage
- LanceDB for vector storage
- Tantivy for BM25 indexing
- MCP server for tool exposure

Usage:
    uvicorn src.main:app --host 0.0.0.0 --port 8765 --reload
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global state for services
services: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting RAG service...")
    
    # Initialize services
    from .storage.sqlite_store import SQLiteStore
    from .storage.lancedb_store import LanceDBStore
    from .storage.tantivy_store import TantivyStore
    from .indexer.document_indexer import DocumentIndexer
    from .retrieval.hybrid_retriever import HybridRetriever
    
    # Get configuration
    db_path = os.getenv("RAG_DB_PATH", "./data/rag.db")
    lancedb_path = os.getenv("RAG_LANCEDB_PATH", "./data/lancedb")
    tantivy_path = os.getenv("RAG_TANTIVY_PATH", "./data/tantivy")
    embedding_model = os.getenv("RAG_EMBEDDING_MODEL", "BAAI/bge-m3")
    
    # Initialize stores
    sqlite_store = SQLiteStore(db_path)
    lancedb_store = LanceDBStore(lancedb_path, embedding_model)
    tantivy_store = TantivyStore(tantivy_path)
    
    # Initialize indexer and retriever
    indexer = DocumentIndexer(sqlite_store, lancedb_store, tantivy_store)
    retriever = HybridRetriever(sqlite_store, lancedb_store, tantivy_store)
    
    # Store services
    services["sqlite"] = sqlite_store
    services["lancedb"] = lancedb_store
    services["tantivy"] = tantivy_store
    services["indexer"] = indexer
    services["retriever"] = retriever
    
    logger.info("RAG service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down RAG service...")
    # Cleanup if needed
    logger.info("RAG service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Zotero-MinerU RAG Service",
    description="RAG service for structured literature workspace",
    version="0.1.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for API
class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "0.1.0"
    services: Dict[str, bool] = Field(default_factory=dict)


class IndexRequest(BaseModel):
    """Request to index a document."""
    item_key: str = Field(..., description="Zotero item key")
    document_json_path: str = Field(..., description="Path to document.json file")
    force: bool = Field(False, description="Force re-indexing")


class IndexResponse(BaseModel):
    """Response for indexing request."""
    success: bool
    message: str
    item_key: str
    chunk_count: Optional[int] = None


class SearchRequest(BaseModel):
    """Search request."""
    query: str = Field(..., description="Search query")
    item_keys: Optional[List[str]] = Field(None, description="Filter by item keys")
    section: Optional[List[str]] = Field(None, description="Filter by section")
    block_type: Optional[List[str]] = Field(None, description="Filter by block type")
    top_k: int = Field(10, description="Number of results to return")
    include_context: bool = Field(True, description="Include context in results")


class SearchResult(BaseModel):
    """Search result item."""
    chunk_id: str
    item_key: str
    block_id: str
    title: str
    section: str
    page: int
    text: str
    context: Optional[Dict[str, str]] = None
    score: float
    retrieval_source: Dict[str, float]


class SearchResponse(BaseModel):
    """Search response."""
    results: List[SearchResult]
    total: int
    query: str


class ChunkContextResponse(BaseModel):
    """Response for chunk context request."""
    chunk_id: str
    text: str
    context: Dict[str, str]
    metadata: Dict[str, Any]


class DocumentOutlineResponse(BaseModel):
    """Response for document outline request."""
    item_key: str
    title: str
    sections: List[Dict[str, Any]]
    block_count: int
    chunk_count: int


class DocumentBlocksResponse(BaseModel):
    """Response for document blocks request."""
    item_key: str
    blocks: List[Dict[str, Any]]
    total: int


# API endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check service health."""
    health_status = {
        "sqlite": services.get("sqlite") is not None,
        "lancedb": services.get("lancedb") is not None,
        "tantivy": services.get("tantivy") is not None,
        "indexer": services.get("indexer") is not None,
        "retriever": services.get("retriever") is not None,
    }
    
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        services=health_status
    )


@app.post("/index/item", response_model=IndexResponse)
async def index_item(request: IndexRequest, background_tasks: BackgroundTasks):
    """Index a document from Zotero."""
    try:
        indexer = services["indexer"]
        
        # Run indexing in background
        async def run_indexing():
            try:
                result = await indexer.index_document(
                    item_key=request.item_key,
                    document_path=request.document_json_path,
                    force=request.force
                )
                logger.info(f"Indexed item {request.item_key}: {result}")
            except Exception as e:
                logger.error(f"Failed to index item {request.item_key}: {e}")
        
        background_tasks.add_task(run_indexing)
        
        return IndexResponse(
            success=True,
            message=f"Indexing started for item {request.item_key}",
            item_key=request.item_key
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search/passages", response_model=SearchResponse)
async def search_passages(request: SearchRequest):
    """Search for passages in indexed documents."""
    try:
        retriever = services["retriever"]
        
        results = await retriever.search(
            query=request.query,
            item_keys=request.item_keys,
            section=request.section,
            block_type=request.block_type,
            top_k=request.top_k,
            include_context=request.include_context
        )
        
        return SearchResponse(
            results=results,
            total=len(results),
            query=request.query
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chunk/{chunk_id}", response_model=ChunkContextResponse)
async def get_chunk(chunk_id: str):
    """Get chunk details by ID."""
    try:
        sqlite_store = services["sqlite"]
        chunk = await sqlite_store.get_chunk(chunk_id)
        
        if not chunk:
            raise HTTPException(status_code=404, detail=f"Chunk {chunk_id} not found")
        
        return ChunkContextResponse(
            chunk_id=chunk["chunk_id"],
            text=chunk["text"],
            context=chunk["context"],
            metadata=chunk["metadata"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chunk/{chunk_id}/context", response_model=ChunkContextResponse)
async def get_chunk_context(chunk_id: str):
    """Get chunk with surrounding context."""
    try:
        retriever = services["retriever"]
        result = await retriever.get_chunk_with_context(chunk_id)
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Chunk {chunk_id} not found")
        
        return ChunkContextResponse(
            chunk_id=result["chunk_id"],
            text=result["text"],
            context=result["context"],
            metadata=result["metadata"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/document/{item_key}/outline", response_model=DocumentOutlineResponse)
async def get_document_outline(item_key: str):
    """Get document outline by item key."""
    try:
        sqlite_store = services["sqlite"]
        document = await sqlite_store.get_document(item_key)
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {item_key} not found")
        
        return DocumentOutlineResponse(
            item_key=document["item_key"],
            title=document["title"],
            sections=document["sections"],
            block_count=document["block_count"],
            chunk_count=document["chunk_count"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/document/{item_key}/blocks", response_model=DocumentBlocksResponse)
async def get_document_blocks(item_key: str, limit: int = 100, offset: int = 0):
    """Get document blocks by item key."""
    try:
        sqlite_store = services["sqlite"]
        blocks = await sqlite_store.get_document_blocks(item_key, limit, offset)
        
        return DocumentBlocksResponse(
            item_key=item_key,
            blocks=blocks,
            total=len(blocks)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status")
async def get_status():
    """Get service status and statistics."""
    try:
        sqlite_store = services["sqlite"]
        
        # Get statistics
        stats = await sqlite_store.get_statistics()
        
        return {
            "status": "running",
            "version": "0.1.0",
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reindex/{item_key}")
async def reindex_item(item_key: str, background_tasks: BackgroundTasks):
    """Re-index a specific item."""
    try:
        indexer = services["indexer"]
        
        async def run_reindexing():
            try:
                await indexer.reindex_document(item_key)
                logger.info(f"Re-indexed item {item_key}")
            except Exception as e:
                logger.error(f"Failed to re-index item {item_key}: {e}")
        
        background_tasks.add_task(run_reindexing)
        
        return {
            "success": True,
            "message": f"Re-indexing started for item {item_key}",
            "item_key": item_key
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/unindexed")
async def get_unindexed_items():
    """Get items that haven't been indexed yet."""
    try:
        sqlite_store = services["sqlite"]
        items = await sqlite_store.get_unindexed_items()
        
        return {
            "items": items,
            "total": len(items)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# MCP server integration
def create_mcp_server():
    """Create MCP server for RAG tools."""
    from .mcp.server import create_rag_mcp_server
    return create_rag_mcp_server(services)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)