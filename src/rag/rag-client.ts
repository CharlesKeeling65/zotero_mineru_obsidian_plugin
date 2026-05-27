/**
 * RAG Service Client
 * 
 * 中文：RAG 服务客户端，用于与 RAG 服务通信，支持文档索引、检索等功能。
 * English: RAG service client for communicating with RAG service, supporting
 * document indexing, retrieval, and other features.
 */

import type { PluginSettings } from "../prefs/settings.js";

/**
 * RAG service client configuration.
 * 
 * 中文：RAG 服务客户端配置。
 * English: RAG service client configuration.
 */
export interface RagClientConfig {
  /** RAG 服务 URL */
  baseUrl: string;
  /** RAG 服务端口 */
  port: number;
  /** 请求超时时间（毫秒） */
  timeoutMs: number;
  /** 重试次数 */
  retries: number;
}

/**
 * Default RAG client configuration.
 * 
 * 中文：默认的 RAG 客户端配置。
 * English: Default RAG client configuration.
 */
const DEFAULT_CONFIG: RagClientConfig = {
  baseUrl: "http://localhost",
  port: 8765,
  timeoutMs: 30000,
  retries: 3
};

/**
 * RAG service client.
 * 
 * 中文：RAG 服务客户端，提供与 RAG 服务的通信接口。
 * English: RAG service client, providing communication interface with RAG service.
 */
export class RagClient {
  private readonly config: RagClientConfig;
  private readonly baseUrl: string;

  constructor(config?: Partial<RagClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = `${this.config.baseUrl}:${this.config.port}`;
  }

  /**
   * Check RAG service health.
   * 
   * 中文：检查 RAG 服务健康状态。
   * English: Check RAG service health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry("/health");
      return response.status === "healthy";
    } catch (error) {
      console.error("RAG service health check failed:", error);
      return false;
    }
  }

  /**
   * Get RAG service status.
   * 
   * 中文：获取 RAG 服务状态。
   * English: Get RAG service status.
   */
  async getStatus(): Promise<{
    status: string;
    version: string;
    statistics: {
      documents: number;
      chunks: number;
      blocks: number;
      indexed_documents: number;
    };
  }> {
    try {
      const response = await this.fetchWithRetry("/status");
      return response;
    } catch (error) {
      console.error("Failed to get RAG service status:", error);
      throw error;
    }
  }

  /**
   * Index a document.
   * 
   * 中文：索引文档。
   * English: Index a document.
   */
  async indexDocument(
    itemKey: string,
    documentJsonPath: string,
    force: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    item_key: string;
    chunk_count?: number;
  }> {
    try {
      const response = await this.fetchWithRetry("/index/item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          item_key: itemKey,
          document_json_path: documentJsonPath,
          force
        })
      });
      return response;
    } catch (error) {
      console.error("Failed to index document:", error);
      throw error;
    }
  }

  /**
   * Search for passages.
   * 
   * 中文：搜索段落。
   * English: Search for passages.
   */
  async searchPassages(
    query: string,
    options: {
      itemKeys?: string[];
      section?: string[];
      blockType?: string[];
      topK?: number;
      includeContext?: boolean;
    } = {}
  ): Promise<{
    results: Array<{
      chunk_id: string;
      item_key: string;
      block_id: string;
      title: string;
      section: string;
      page: number;
      text: string;
      context?: {
        before: string;
        after: string;
        section: string;
        subsection: string;
      };
      score: number;
      retrieval_source: {
        bm25: number | null;
        vector: number | null;
        rerank: number | null;
      };
    }>;
    total: number;
    query: string;
  }> {
    try {
      const response = await this.fetchWithRetry("/search/passages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          item_keys: options.itemKeys,
          section: options.section,
          block_type: options.blockType,
          top_k: options.topK || 10,
          include_context: options.includeContext !== false
        })
      });
      return response;
    } catch (error) {
      console.error("Failed to search passages:", error);
      throw error;
    }
  }

  /**
   * Get chunk details.
   * 
   * 中文：获取 Chunk 详情。
   * English: Get chunk details.
   */
  async getChunk(chunkId: string): Promise<{
    chunk_id: string;
    text: string;
    context: {
      before: string;
      after: string;
      section: string;
      subsection: string;
    };
    metadata: {
      item_key: string;
      block_id: string;
      block_type: string;
      page_start: number;
      page_end: number;
      order_index: number;
    };
  }> {
    try {
      const response = await this.fetchWithRetry(`/chunk/${chunkId}`);
      return response;
    } catch (error) {
      console.error("Failed to get chunk:", error);
      throw error;
    }
  }

  /**
   * Get chunk with context.
   * 
   * 中文：获取 Chunk 及其上下文。
   * English: Get chunk with context.
   */
  async getChunkContext(chunkId: string): Promise<{
    chunk_id: string;
    text: string;
    context: {
      before: string;
      after: string;
      section: string;
      subsection: string;
    };
    metadata: {
      item_key: string;
      block_id: string;
      block_type: string;
      page_start: number;
      page_end: number;
      order_index: number;
    };
  }> {
    try {
      const response = await this.fetchWithRetry(`/chunk/${chunkId}/context`);
      return response;
    } catch (error) {
      console.error("Failed to get chunk context:", error);
      throw error;
    }
  }

  /**
   * Get document outline.
   * 
   * 中文：获取文档大纲。
   * English: Get document outline.
   */
  async getDocumentOutline(itemKey: string): Promise<{
    item_key: string;
    title: string;
    sections: Array<{
      title: string;
      level: number;
      block_ids: string[];
    }>;
    block_count: number;
    chunk_count: number;
  }> {
    try {
      const response = await this.fetchWithRetry(`/document/${itemKey}/outline`);
      return response;
    } catch (error) {
      console.error("Failed to get document outline:", error);
      throw error;
    }
  }

  /**
   * Get document blocks.
   * 
   * 中文：获取文档 Block。
   * English: Get document blocks.
   */
  async getDocumentBlocks(
    itemKey: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    item_key: string;
    blocks: Array<{
      block_id: string;
      type: string;
      section_path: string[];
      page_start: number;
      page_end: number;
      order_index: number;
      content_text: string;
      content_markdown: string;
      caption: string;
    }>;
    total: number;
  }> {
    try {
      const response = await this.fetchWithRetry(
        `/document/${itemKey}/blocks?limit=${limit}&offset=${offset}`
      );
      return response;
    } catch (error) {
      console.error("Failed to get document blocks:", error);
      throw error;
    }
  }

  /**
   * Re-index a document.
   * 
   * 中文：重新索引文档。
   * English: Re-index a document.
   */
  async reindexDocument(itemKey: string): Promise<{
    success: boolean;
    message: string;
    item_key: string;
  }> {
    try {
      const response = await this.fetchWithRetry(`/reindex/${itemKey}`, {
        method: "POST"
      });
      return response;
    } catch (error) {
      console.error("Failed to re-index document:", error);
      throw error;
    }
  }

  /**
   * Get unindexed items.
   * 
   * 中文：获取未索引的项目。
   * English: Get unindexed items.
   */
  async getUnindexedItems(): Promise<{
    items: Array<{
      item_key: string;
      title: string;
      pdf_path: string;
    }>;
    total: number;
  }> {
    try {
      const response = await this.fetchWithRetry("/unindexed");
      return response;
    } catch (error) {
      console.error("Failed to get unindexed items:", error);
      throw error;
    }
  }

  /**
   * Fetch with retry logic.
   * 
   * 中文：带重试逻辑的请求。
   * English: Fetch with retry logic.
   */
  private async fetchWithRetry(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `RAG service request failed (attempt ${attempt + 1}/${this.config.retries}):`,
          error
        );

        // Wait before retry (exponential backoff)
        if (attempt < this.config.retries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error("Failed to fetch from RAG service");
  }
}

/**
 * Create a RAG client from plugin settings.
 * 
 * 中文：从插件设置创建 RAG 客户端。
 * English: Create a RAG client from plugin settings.
 */
export function createRagClientFromSettings(
  settings: PluginSettings
): RagClient {
  return new RagClient({
    baseUrl: settings.ragServiceUrl,
    port: settings.ragServicePort,
    timeoutMs: 30000,
    retries: 3
  });
}