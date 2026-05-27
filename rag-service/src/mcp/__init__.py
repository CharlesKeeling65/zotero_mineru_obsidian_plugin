"""
MCP (Model Context Protocol) server for RAG service.

This module provides MCP server interface for the RAG service,
exposing RAG tools that can be used by AI agents.
"""

from .server import create_rag_mcp_server, run_mcp_server

__all__ = ["create_rag_mcp_server", "run_mcp_server"]