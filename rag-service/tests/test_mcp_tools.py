"""
Test MCP tools for RAG service.

This module tests the MCP tools exposed by the RAG service.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

# Import MCP server
from src.mcp.server import create_rag_mcp_server


@pytest.fixture
def mock_services():
    """Create mock services for testing."""
    return {
        "sqlite": AsyncMock(),
        "lancedb": AsyncMock(),
        "tantivy": AsyncMock(),
        "indexer": AsyncMock(),
        "retriever": AsyncMock()
    }


@pytest.fixture
def mcp_server(mock_services):
    """Create MCP server with mock services."""
    return create_rag_mcp_server(mock_services)


@pytest.mark.asyncio
async def test_list_tools(mcp_server):
    """Test listing available tools."""
    tools = await mcp_server.list_tools()
    
    # Check that all P0 tools are available
    tool_names = [tool.name for tool in tools]
    
    p0_tools = [
        "rag_status",
        "rag_index_item",
        "rag_search_passages",
        "rag_get_chunk",
        "rag_get_chunk_context",
        "rag_get_document_outline",
        "rag_get_document_blocks"
    ]
    
    for tool in p0_tools:
        assert tool in tool_names, f"Tool {tool} not found in available tools"


@pytest.mark.asyncio
async def test_rag_status(mcp_server, mock_services):
    """Test rag_status tool."""
    # Mock statistics
    mock_services["sqlite"].get_statistics.return_value = {
        "documents": 10,
        "chunks": 100,
        "blocks": 50,
        "indexed_documents": 8
    }
    
    # Call tool
    result = await mcp_server.call_tool("rag_status", {})
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert result_data["status"] == "running"
    assert result_data["statistics"]["documents"] == 10
    assert result_data["statistics"]["chunks"] == 100


@pytest.mark.asyncio
async def test_rag_search_passages(mcp_server, mock_services):
    """Test rag_search_passages tool."""
    # Mock search results
    mock_services["retriever"].search.return_value = [
        {
            "chunk_id": "chunk_001",
            "item_key": "ABCD1234",
            "block_id": "block_001",
            "text": "Test passage",
            "score": 0.85,
            "retrieval_source": "hybrid"
        }
    ]
    
    # Call tool
    result = await mcp_server.call_tool("rag_search_passages", {
        "query": "test query",
        "top_k": 5
    })
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert len(result_data["results"]) == 1
    assert result_data["results"][0]["chunk_id"] == "chunk_001"


@pytest.mark.asyncio
async def test_rag_get_chunk(mcp_server, mock_services):
    """Test rag_get_chunk tool."""
    # Mock chunk data
    mock_services["sqlite"].get_chunk.return_value = {
        "chunk_id": "chunk_001",
        "text": "Test chunk text",
        "context": {
            "before": "Previous text",
            "after": "Next text",
            "section": "Methods"
        },
        "metadata": {
            "item_key": "ABCD1234",
            "block_type": "text"
        }
    }
    
    # Call tool
    result = await mcp_server.call_tool("rag_get_chunk", {
        "chunk_id": "chunk_001"
    })
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert result_data["chunk_id"] == "chunk_001"
    assert result_data["text"] == "Test chunk text"


@pytest.mark.asyncio
async def test_rag_get_document_outline(mcp_server, mock_services):
    """Test rag_get_document_outline tool."""
    # Mock document data
    mock_services["sqlite"].get_document.return_value = {
        "item_key": "ABCD1234",
        "title": "Test Document",
        "sections": [
            {"title": "Abstract", "level": 1},
            {"title": "Introduction", "level": 1}
        ],
        "block_count": 20,
        "chunk_count": 25
    }
    
    # Call tool
    result = await mcp_server.call_tool("rag_get_document_outline", {
        "item_key": "ABCD1234"
    })
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert result_data["item_key"] == "ABCD1234"
    assert result_data["title"] == "Test Document"
    assert len(result_data["sections"]) == 2


@pytest.mark.asyncio
async def test_rag_get_evidence_pack(mcp_server, mock_services):
    """Test rag_get_evidence_pack tool."""
    # Mock search results
    mock_services["retriever"].search.return_value = [
        {
            "chunk_id": "chunk_001",
            "item_key": "ABCD1234",
            "block_id": "block_001",
            "text": "Evidence text",
            "score": 0.9,
            "retrieval_source": "hybrid"
        }
    ]
    
    # Call tool
    result = await mcp_server.call_tool("rag_get_evidence_pack", {
        "query": "test evidence",
        "top_k": 3
    })
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert result_data["query"] == "test evidence"
    assert len(result_data["results"]) == 1
    assert result_data["confidence"] == "high"


@pytest.mark.asyncio
async def test_tool_error_handling(mcp_server, mock_services):
    """Test tool error handling."""
    # Mock error
    mock_services["sqlite"].get_statistics.side_effect = Exception("Database error")
    
    # Call tool
    result = await mcp_server.call_tool("rag_status", {})
    
    # Parse result
    result_data = json.loads(result[0].text)
    
    assert "error" in result_data


if __name__ == "__main__":
    pytest.main([__file__])