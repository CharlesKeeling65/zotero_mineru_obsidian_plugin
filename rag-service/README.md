# RAG Service for Zotero-MinerU Structured Literature Workspace

This service provides RAG (Retrieval-Augmented Generation) capabilities for the Zotero-MinerU structured literature workspace.

## Features

1. **Document Indexing**: Index documents from Zotero into the RAG system
2. **Hybrid Retrieval**: Combine BM25 and vector search for accurate retrieval
3. **MCP Server**: Expose RAG tools via MCP protocol for AI agents
4. **Evidence Packs**: Provide evidence-based answers with citations

## Architecture

```
┌─────────────────────────────────────────────┐
│                RAG Service                  │
├─────────────────────────────────────────────┤
│  FastAPI REST API                          │
│  MCP Server (JSON-RPC 2.0)                 │
├─────────────────────────────────────────────┤
│  Storage Layer                             │
│  - SQLite (metadata, blocks)               │
│  - LanceDB (vector index)                  │
│  - Tantivy (BM25 index)                    │
├─────────────────────────────────────────────┤
│  Retrieval Layer                           │
│  - Hybrid Retriever                        │
│  - Cross-encoder Reranker                  │
│  - Context Expansion                       │
└─────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd rag-service
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

```env
RAG_HOST=0.0.0.0
RAG_PORT=8765
RAG_DB_PATH=./data/rag.db
RAG_LANCEDB_PATH=./data/lancedb
RAG_TANTIVY_PATH=./data/tantivy
RAG_EMBEDDING_MODEL=BAAI/bge-m3
```

### 3. Start the Service

```bash
# Start REST API
uvicorn src.main:app --host 0.0.0.0 --port 8765 --reload

# Start MCP Server (for AI agents)
python -m src.mcp.server
```

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/index/item` | POST | Index a document |
| `/search/passages` | POST | Search for passages |
| `/chunk/{chunk_id}` | GET | Get chunk details |
| `/chunk/{chunk_id}/context` | GET | Get chunk with context |
| `/document/{item_key}/outline` | GET | Get document outline |
| `/document/{item_key}/blocks` | GET | Get document blocks |
| `/status` | GET | Get service status |
| `/reindex/{item_key}` | POST | Re-index a document |
| `/unindexed` | GET | Get unindexed items |

### MCP Tools

| Tool | Description |
|------|-------------|
| `rag_status` | Check RAG service status |
| `rag_index_item` | Index a document |
| `rag_search_passages` | Search for passages |
| `rag_get_chunk` | Get chunk details |
| `rag_get_chunk_context` | Get chunk with context |
| `rag_get_document_outline` | Get document outline |
| `rag_get_document_blocks` | Get document blocks |
| `rag_search_figures` | Search for figures |
| `rag_search_tables` | Search for tables |
| `rag_search_formulas` | Search for formulas |
| `rag_get_evidence_pack` | Get evidence pack |
| `rag_get_unindexed_items` | Get unindexed items |
| `rag_reindex_item` | Re-index a document |

## Usage Examples

### Index a Document

```bash
curl -X POST http://localhost:8765/index/item \
  -H "Content-Type: application/json" \
  -d '{
    "item_key": "ABCD1234",
    "document_json_path": "/path/to/document.json",
    "force": false
  }'
```

### Search for Passages

```bash
curl -X POST http://localhost:8765/search/passages \
  -H "Content-Type: application/json" \
  -d '{
    "query": "manure transport nitrogen surplus",
    "item_keys": ["ABCD1234"],
    "section": ["Results", "Discussion"],
    "top_k": 10,
    "include_context": true
  }'
```

### Get Evidence Pack

```bash
curl -X POST http://localhost:8765/search/passages \
  -H "Content-Type: application/json" \
  -d '{
    "query": "evidence that manure transport can reduce nitrogen surplus",
    "item_keys": ["ABCD1234", "EFGH5678"],
    "top_k": 5,
    "include_context": true
  }'
```

## MCP Integration

To use the RAG service with AI agents via MCP:

1. **Start the MCP server**:
   ```bash
   python -m src.mcp.server
   ```

2. **Configure your AI agent** to connect to the MCP server:
   ```json
   {
     "mcpServers": {
       "zotero-rag": {
         "command": "python",
         "args": ["-m", "src.mcp.server"],
         "cwd": "/path/to/rag-service"
       }
     }
   }
   ```

3. **Use the tools** in your AI agent:
   ```python
   # Example: Search for passages
   result = await mcp.call_tool("rag_search_passages", {
       "query": "your search query",
       "item_keys": ["ABCD1234"],
       "top_k": 10
   })
   ```

## Development

### Running Tests

```bash
cd rag-service
pytest tests/
```

### Code Structure

```
rag-service/
├── src/
│   ├── main.py              # FastAPI application
│   ├── mcp/                 # MCP server
│   │   ├── __init__.py
│   │   └── server.py
│   ├── storage/             # Storage layer
│   │   ├── __init__.py
│   │   └── sqlite_store.py
│   ├── retrieval/           # Retrieval layer
│   │   ├── __init__.py
│   │   └── hybrid_retriever.py
│   ├── indexer/             # Indexing layer
│   │   ├── __init__.py
│   │   └── document_indexer.py
│   └── __init__.py
├── config/                  # Configuration
│   ├── __init__.py
│   └── settings.py
├── tests/                   # Tests
│   └── test_mcp_tools.py
├── requirements.txt         # Dependencies
└── README.md               # This file
```

## Integration with Zotero Plugin

The RAG service integrates with the Zotero plugin through:

1. **File System Watch**: The plugin writes `document.json` files, and the RAG service watches for changes
2. **HTTP API**: The plugin can call the RAG service API directly
3. **MCP Protocol**: AI agents can use both Zotero MCP and RAG MCP together

### Workflow

1. **User selects PDF in Zotero**
2. **Plugin parses PDF with MinerU**
3. **Plugin generates structured data** (`document.json`, blocks, chunks)
4. **Plugin writes to sidecar folder** (`.zotero-rag/items/{item_key}/`)
5. **RAG service indexes the document**
6. **AI agent uses Zotero MCP + RAG MCP** to answer questions

## Performance Considerations

- **Indexing**: 100-page PDF typically indexes in < 2 minutes
- **Retrieval**: Top-10 results typically returned in < 500ms
- **Memory**: Uses streaming processing to avoid loading large files
- **Storage**: SQLite for metadata, LanceDB for vectors, Tantivy for BM25

## Troubleshooting

### Common Issues

1. **Service won't start**: Check if ports are available and dependencies are installed
2. **Indexing fails**: Verify document.json path and format
3. **Search returns no results**: Check if documents are indexed and filters are correct
4. **MCP connection fails**: Ensure MCP server is running and configured correctly

### Logs

Check logs for detailed error information:

```bash
# View service logs
tail -f logs/rag-service.log

# View MCP server logs
tail -f logs/mcp-server.log
```

## License

This project is part of the Zotero-MinerU Structured Literature Workspace.