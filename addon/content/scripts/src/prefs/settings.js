export const DEFAULT_SETTINGS = {
    mineruBaseUrl: "",
    mineruApiKey: "",
    vaultRootDir: "",
    preferredBackend: "agent",
    // RAG service defaults
    ragServiceEnabled: false,
    ragServiceUrl: "http://localhost",
    ragServicePort: 8765,
    ragAutoIndex: true,
    ragIndexOnParse: true,
    ragNotifyOnIndex: true,
    // Chunk defaults
    chunkStrategy: "paragraph",
    maxChunkTokens: 512,
    minChunkTokens: 50,
    chunkOverlapTokens: 50,
    // Embedding defaults
    embeddingModel: "BAAI/bge-m3",
    computeEmbeddings: true
};
