"""
MCP Server for RAG Service

This module provides MCP (Model Context Protocol) server interface for the RAG service.
It exposes RAG tools as MCP tools that can be used by AI agents.

MCP Tools:
- rag_status: Check RAG service status
- rag_index_item: Index a document
- rag_search_passages: Search for passages
- rag_get_chunk: Get chunk details
- rag_get_chunk_context: Get chunk with context
- rag_get_document_outline: Get document outline
- rag_get_document_blocks: Get document blocks
- rag_search_figures: Search for figures
- rag_search_tables: Search for tables
- rag_search_formulas: Search for formulas
- rag_get_evidence_pack: Get evidence pack for a query
- rag_get_unindexed_items: Get unindexed items
- rag_reindex_item: Re-index a document
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Sequence

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

logger = logging.getLogger(__name__)


def create_rag_mcp_server(services: Dict[str, Any]) -> Server:
    """Create MCP server for RAG tools."""
    
    server = Server("zotero-rag-mcp")
    
    @server.list_tools()
    async def list_tools() -> List[types.Tool]:
        """List available RAG tools."""
        return [
            types.Tool(
                name="rag_status",
                description="Check RAG service status and statistics",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            ),
            types.Tool(
                name="rag_index_item",
                description="Index a document from Zotero",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "item_key": {
                            "type": "string",
                            "description": "Zotero item key"
                        },
                        "document_json_path": {
                            "type": "string",
                            "description": "Path to document.json file"
                        },
                        "force": {
                            "type": "boolean",
                            "description": "Force re-indexing",
                            "default": False
                        }
                    },
                    "required": ["item_key", "document_json_path"]
                }
            ),
            types.Tool(
                name="rag_search_passages",
                description="Search for passages in indexed documents",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "item_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by item keys"
                        },
                        "section": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by section"
                        },
                        "block_type": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by block type"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 10
                        },
                        "include_context": {
                            "type": "boolean",
                            "description": "Include context in results",
                            "default": True
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="rag_get_chunk",
                description="Get chunk details by ID",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "chunk_id": {
                            "type": "string",
                            "description": "Chunk ID"
                        }
                    },
                    "required": ["chunk_id"]
                }
            ),
            types.Tool(
                name="rag_get_chunk_context",
                description="Get chunk with surrounding context",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "chunk_id": {
                            "type": "string",
                            "description": "Chunk ID"
                        }
                    },
                    "required": ["chunk_id"]
                }
            ),
            types.Tool(
                name="rag_get_document_outline",
                description="Get document outline by item key",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "item_key": {
                            "type": "string",
                            "description": "Zotero item key"
                        }
                    },
                    "required": ["item_key"]
                }
            ),
            types.Tool(
                name="rag_get_document_blocks",
                description="Get document blocks by item key",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "item_key": {
                            "type": "string",
                            "description": "Zotero item key"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of blocks to return",
                            "default": 100
                        },
                        "offset": {
                            "type": "integer",
                            "description": "Offset for pagination",
                            "default": 0
                        }
                    },
                    "required": ["item_key"]
                }
            ),
            types.Tool(
                name="rag_search_figures",
                description="Search for figures in indexed documents",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "item_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by item keys"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="rag_search_tables",
                description="Search for tables in indexed documents",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "item_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by item keys"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="rag_search_formulas",
                description="Search for formulas in indexed documents",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "item_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by item keys"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="rag_get_evidence_pack",
                description="Get evidence pack for a query with citations",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "item_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Filter by item keys"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="rag_get_unindexed_items",
                description="Get items that haven't been indexed yet",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            ),
            types.Tool(
                name="rag_reindex_item",
                description="Re-index a specific document",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "item_key": {
                            "type": "string",
                            "description": "Zotero item key"
                        }
                    },
                    "required": ["item_key"]
                }
            )
        ]
    
    @server.call_tool()
    async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
        """Handle tool calls."""
        try:
            if name == "rag_status":
                return await handle_rag_status(services)
            elif name == "rag_index_item":
                return await handle_rag_index_item(services, arguments)
            elif name == "rag_search_passages":
                return await handle_rag_search_passages(services, arguments)
            elif name == "rag_get_chunk":
                return await handle_rag_get_chunk(services, arguments)
            elif name == "rag_get_chunk_context":
                return await handle_rag_get_chunk_context(services, arguments)
            elif name == "rag_get_document_outline":
                return await handle_rag_get_document_outline(services, arguments)
            elif name == "rag_get_document_blocks":
                return await handle_rag_get_document_blocks(services, arguments)
            elif name == "rag_search_figures":
                return await handle_rag_search_by_type(services, arguments, "figure")
            elif name == "rag_search_tables":
                return await handle_rag_search_by_type(services, arguments, "table")
            elif name == "rag_search_formulas":
                return await handle_rag_search_by_type(services, arguments, "formula")
            elif name == "rag_get_evidence_pack":
                return await handle_rag_get_evidence_pack(services, arguments)
            elif name == "rag_get_unindexed_items":
                return await handle_rag_get_unindexed_items(services)
            elif name == "rag_reindex_item":
                return await handle_rag_reindex_item(services, arguments)
            else:
                raise ValueError(f"Unknown tool: {name}")
        except Exception as e:
            logger.error(f"Error in tool {name}: {e}")
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": str(e)}, ensure_ascii=False)
            )]
    
    return server


async def handle_rag_status(services: Dict[str, Any]) -> List[types.TextContent]:
    """Handle rag_status tool."""
    try:
        sqlite_store = services["sqlite"]
        stats = await sqlite_store.get_statistics()
        
        result = {
            "status": "running",
            "version": "0.1.0",
            "statistics": stats
        }
        
        return [types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get status: {e}")


async def handle_rag_index_item(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_index_item tool."""
    try:
        indexer = services["indexer"]
        item_key = arguments["item_key"]
        document_path = arguments["document_json_path"]
        force = arguments.get("force", False)
        
        result = await indexer.index_document(
            item_key=item_key,
            document_path=document_path,
            force=force
        )
        
        return [types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to index item: {e}")


async def handle_rag_search_passages(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_search_passages tool."""
    try:
        retriever = services["retriever"]
        
        results = await retriever.search(
            query=arguments["query"],
            item_keys=arguments.get("item_keys"),
            section=arguments.get("section"),
            block_type=arguments.get("block_type"),
            top_k=arguments.get("top_k", 10),
            include_context=arguments.get("include_context", True)
        )
        
        return [types.TextContent(
            type="text",
            text=json.dumps({"results": results}, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to search passages: {e}")


async def handle_rag_get_chunk(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_chunk tool."""
    try:
        sqlite_store = services["sqlite"]
        chunk_id = arguments["chunk_id"]
        
        chunk = await sqlite_store.get_chunk(chunk_id)
        if not chunk:
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": f"Chunk {chunk_id} not found"}, ensure_ascii=False)
            )]
        
        return [types.TextContent(
            type="text",
            text=json.dumps(chunk, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get chunk: {e}")


async def handle_rag_get_chunk_context(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_chunk_context tool."""
    try:
        retriever = services["retriever"]
        chunk_id = arguments["chunk_id"]
        
        result = await retriever.get_chunk_with_context(chunk_id)
        if not result:
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": f"Chunk {chunk_id} not found"}, ensure_ascii=False)
            )]
        
        return [types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get chunk context: {e}")


async def handle_rag_get_document_outline(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_document_outline tool."""
    try:
        sqlite_store = services["sqlite"]
        item_key = arguments["item_key"]
        
        document = await sqlite_store.get_document(item_key)
        if not document:
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": f"Document {item_key} not found"}, ensure_ascii=False)
            )]
        
        return [types.TextContent(
            type="text",
            text=json.dumps(document, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get document outline: {e}")


async def handle_rag_get_document_blocks(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_document_blocks tool."""
    try:
        sqlite_store = services["sqlite"]
        item_key = arguments["item_key"]
        limit = arguments.get("limit", 100)
        offset = arguments.get("offset", 0)
        
        blocks = await sqlite_store.get_document_blocks(item_key, limit, offset)
        
        return [types.TextContent(
            type="text",
            text=json.dumps({"blocks": blocks}, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get document blocks: {e}")


async def handle_rag_search_by_type(
    services: Dict[str, Any], 
    arguments: Dict[str, Any],
    block_type: str
) -> List[types.TextContent]:
    """Handle search by block type (figure, table, formula)."""
    try:
        retriever = services["retriever"]
        
        results = await retriever.search(
            query=arguments["query"],
            item_keys=arguments.get("item_keys"),
            block_type=[block_type],
            top_k=arguments.get("top_k", 10),
            include_context=True
        )
        
        return [types.TextContent(
            type="text",
            text=json.dumps({"results": results}, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to search {block_type}s: {e}")


async def handle_rag_get_evidence_pack(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_evidence_pack tool."""
    try:
        retriever = services["retriever"]
        
        # Search for passages
        results = await retriever.search(
            query=arguments["query"],
            item_keys=arguments.get("item_keys"),
            top_k=arguments.get("top_k", 5),
            include_context=True
        )
        
        # Create evidence pack using the evidence system
        from ..evidence.evidence_pack import create_evidence_pack, format_evidence_pack
        
        evidence_pack = create_evidence_pack(
            query=arguments["query"],
            results=results,
            metadata={
                "item_keys": arguments.get("item_keys"),
                "top_k": arguments.get("top_k", 5)
            }
        )
        
        # Format as JSON
        evidence_json = format_evidence_pack(evidence_pack, format="json")
        
        return [types.TextContent(
            type="text",
            text=evidence_json
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get evidence pack: {e}")


async def handle_rag_get_unindexed_items(
    services: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_get_unindexed_items tool."""
    try:
        sqlite_store = services["sqlite"]
        items = await sqlite_store.get_unindexed_items()
        
        return [types.TextContent(
            type="text",
            text=json.dumps({"items": items}, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to get unindexed items: {e}")


async def handle_rag_reindex_item(
    services: Dict[str, Any], 
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle rag_reindex_item tool."""
    try:
        indexer = services["indexer"]
        item_key = arguments["item_key"]
        
        result = await indexer.reindex_document(item_key)
        
        return [types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        raise RuntimeError(f"Failed to re-index item: {e}")


async def run_mcp_server():
    """Run MCP server."""
    from .main import services
    
    server = create_rag_mcp_server(services)
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(run_mcp_server())