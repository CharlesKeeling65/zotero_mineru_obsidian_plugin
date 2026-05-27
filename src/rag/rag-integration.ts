/**
 * RAG Integration Module
 * 
 * 中文：RAG 集成模块，负责协调 Zotero 插件与 RAG 服务的交互。
 * English: RAG integration module, responsible for coordinating interaction
 * between Zotero plugin and RAG service.
 */

import type { PluginSettings } from "../prefs/settings.js";
import type { NormalizedDocument } from "../normalize/normalizer.js";
import { RagClient, createRagClientFromSettings } from "./rag-client.js";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

/**
 * RAG integration status.
 * 
 * 中文：RAG 集成状态。
 * English: RAG integration status.
 */
export type RagIntegrationStatus = 
  | "disabled"      // RAG 集成已禁用
  | "disconnected"  // RAG 服务未连接
  | "connected"     // RAG 服务已连接
  | "indexing"      // 正在索引
  | "indexed"       // 已索引
  | "error";        // 错误状态

/**
 * RAG integration result.
 * 
 * 中文：RAG 集成结果。
 * English: RAG integration result.
 */
export interface RagIntegrationResult {
  /** 状态 */
  status: RagIntegrationStatus;
  /** 消息 */
  message: string;
  /** 项目 key */
  itemKey?: string;
  /** Chunk 数量 */
  chunkCount?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * RAG integration module.
 * 
 * 中文：RAG 集成模块，提供与 RAG 服务的集成接口。
 * English: RAG integration module, providing integration interface with RAG service.
 */
export class RagIntegration {
  private readonly settings: PluginSettings;
  private readonly ragClient: RagClient;
  private status: RagIntegrationStatus = "disconnected";

  constructor(settings: PluginSettings) {
    this.settings = settings;
    this.ragClient = createRagClientFromSettings(settings);
  }

  /**
   * Get current status.
   * 
   * 中文：获取当前状态。
   * English: Get current status.
   */
  getStatus(): RagIntegrationStatus {
    return this.status;
  }

  /**
   * Check if RAG service is available.
   * 
   * 中文：检查 RAG 服务是否可用。
   * English: Check if RAG service is available.
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.settings.ragServiceEnabled) {
      this.status = "disabled";
      return false;
    }

    try {
      const isHealthy = await this.ragClient.checkHealth();
      this.status = isHealthy ? "connected" : "disconnected";
      return isHealthy;
    } catch (error) {
      this.status = "disconnected";
      return false;
    }
  }

  /**
   * Index a document with RAG service.
   * 
   * 中文：使用 RAG 服务索引文档。
   * English: Index a document with RAG service.
   */
  async indexDocument(
    normalized: NormalizedDocument,
    pdfPath: string
  ): Promise<RagIntegrationResult> {
    if (!this.settings.ragServiceEnabled) {
      return {
        status: "disabled",
        message: "RAG integration is disabled"
      };
    }

    try {
      this.status = "indexing";
      
      // Create sidecar directory
      const itemKey = normalized.document.source.zoteroItemKey;
      const sidecarDir = this.getSidecarDir(pdfPath, itemKey);
      await mkdir(sidecarDir, { recursive: true });
      
      // Write document.json
      const documentJsonPath = join(sidecarDir, "document.json");
      await writeFile(
        documentJsonPath,
        JSON.stringify(normalized, null, 2),
        "utf8"
      );
      
      // Index with RAG service
      const result = await this.ragClient.indexDocument(
        itemKey,
        documentJsonPath,
        false
      );
      
      if (result.success) {
        this.status = "indexed";
        return {
          status: "indexed",
          message: result.message,
          itemKey: result.item_key,
          chunkCount: result.chunk_count
        };
      } else {
        this.status = "error";
        return {
          status: "error",
          message: result.message,
          itemKey: result.item_key,
          error: result.message
        };
      }
    } catch (error) {
      this.status = "error";
      return {
        status: "error",
        message: "Failed to index document",
        error: (error as Error).message
      };
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
  ) {
    if (!this.settings.ragServiceEnabled) {
      throw new Error("RAG integration is disabled");
    }

    try {
      return await this.ragClient.searchPassages(query, options);
    } catch (error) {
      console.error("Failed to search passages:", error);
      throw error;
    }
  }

  /**
   * Get document outline.
   * 
   * 中文：获取文档大纲。
   * English: Get document outline.
   */
  async getDocumentOutline(itemKey: string) {
    if (!this.settings.ragServiceEnabled) {
      throw new Error("RAG integration is disabled");
    }

    try {
      return await this.ragClient.getDocumentOutline(itemKey);
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
  ) {
    if (!this.settings.ragServiceEnabled) {
      throw new Error("RAG integration is disabled");
    }

    try {
      return await this.ragClient.getDocumentBlocks(itemKey, limit, offset);
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
  async reindexDocument(itemKey: string): Promise<RagIntegrationResult> {
    if (!this.settings.ragServiceEnabled) {
      return {
        status: "disabled",
        message: "RAG integration is disabled"
      };
    }

    try {
      this.status = "indexing";
      
      const result = await this.ragClient.reindexDocument(itemKey);
      
      if (result.success) {
        this.status = "indexed";
        return {
          status: "indexed",
          message: result.message,
          itemKey: result.item_key
        };
      } else {
        this.status = "error";
        return {
          status: "error",
          message: result.message,
          itemKey: result.item_key,
          error: result.message
        };
      }
    } catch (error) {
      this.status = "error";
      return {
        status: "error",
        message: "Failed to re-index document",
        error: (error as Error).message
      };
    }
  }

  /**
   * Get unindexed items.
   * 
   * 中文：获取未索引的项目。
   * English: Get unindexed items.
   */
  async getUnindexedItems() {
    if (!this.settings.ragServiceEnabled) {
      throw new Error("RAG integration is disabled");
    }

    try {
      return await this.ragClient.getUnindexedItems();
    } catch (error) {
      console.error("Failed to get unindexed items:", error);
      throw error;
    }
  }

  /**
   * Get sidecar directory for an item.
   * 
   * 中文：获取项目的 sidecar 目录。
   * English: Get sidecar directory for an item.
   */
  private getSidecarDir(pdfPath: string, itemKey: string): string {
    const pdfDir = dirname(pdfPath);
    return join(pdfDir, ".zotero-rag", "items", itemKey);
  }

  /**
   * Write status note to Zotero.
   * 
   * 中文：向 Zotero 写入状态笔记。
   * English: Write status note to Zotero.
   */
  async writeStatusNote(
    itemKey: string,
    status: RagIntegrationStatus,
    message: string
  ): Promise<void> {
    // This would integrate with Zotero API to create a child note
    // For now, we'll just log it
    console.log(`Writing status note for ${itemKey}: ${status} - ${message}`);
  }

  /**
   * Write status tag to Zotero.
   * 
   * 中文：向 Zotero 写入状态标签。
   * English: Write status tag to Zotero.
   */
  async writeStatusTag(
    itemKey: string,
    status: RagIntegrationStatus
  ): Promise<void> {
    // This would integrate with Zotero API to add tags
    // For now, we'll just log it
    const tag = status === "indexed" ? "#RAGIndexed" : "#RAGFailed";
    console.log(`Writing tag ${tag} for ${itemKey}`);
  }
}

/**
 * Create RAG integration from settings.
 * 
 * 中文：从设置创建 RAG 集成。
 * English: Create RAG integration from settings.
 */
export function createRagIntegration(settings: PluginSettings): RagIntegration {
  return new RagIntegration(settings);
}