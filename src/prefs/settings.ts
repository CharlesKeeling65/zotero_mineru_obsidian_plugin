export interface PluginSettings {
  mineruBaseUrl: string;
  mineruApiKey: string;
  vaultRootDir: string;
  preferredBackend: "agent" | "standard";
  
  // RAG service settings
  ragServiceEnabled: boolean;
  ragServiceUrl: string;
  ragServicePort: number;
  ragAutoIndex: boolean;
  ragIndexOnParse: boolean;
  ragNotifyOnIndex: boolean;
  
  // Chunk settings
  chunkStrategy: "paragraph" | "section" | "merged" | "split";
  maxChunkTokens: number;
  minChunkTokens: number;
  chunkOverlapTokens: number;
  
  // Embedding settings
  embeddingModel: string;
  computeEmbeddings: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
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
