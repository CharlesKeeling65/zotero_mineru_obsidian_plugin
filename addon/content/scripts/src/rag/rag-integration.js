/**
 * RAG Integration Module
 *
 * 中文：RAG 集成模块，负责协调 Zotero 插件与 RAG 服务的交互。
 * English: RAG integration module, responsible for coordinating interaction
 * between Zotero plugin and RAG service.
 */
import { createRagClientFromSettings } from "./rag-client.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
/**
 * RAG integration module.
 *
 * 中文：RAG 集成模块，提供与 RAG 服务的集成接口。
 * English: RAG integration module, providing integration interface with RAG service.
 */
export class RagIntegration {
    settings;
    ragClient;
    status = "disconnected";
    constructor(settings) {
        this.settings = settings;
        this.ragClient = createRagClientFromSettings(settings);
    }
    /**
     * Get current status.
     *
     * 中文：获取当前状态。
     * English: Get current status.
     */
    getStatus() {
        return this.status;
    }
    /**
     * Check if RAG service is available.
     *
     * 中文：检查 RAG 服务是否可用。
     * English: Check if RAG service is available.
     */
    async checkAvailability() {
        if (!this.settings.ragServiceEnabled) {
            this.status = "disabled";
            return false;
        }
        try {
            const isHealthy = await this.ragClient.checkHealth();
            this.status = isHealthy ? "connected" : "disconnected";
            return isHealthy;
        }
        catch (error) {
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
    async indexDocument(normalized, pdfPath) {
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
            await writeFile(documentJsonPath, JSON.stringify(normalized, null, 2), "utf8");
            // Index with RAG service
            const result = await this.ragClient.indexDocument(itemKey, documentJsonPath, false);
            if (result.success) {
                this.status = "indexed";
                return {
                    status: "indexed",
                    message: result.message,
                    itemKey: result.item_key,
                    chunkCount: result.chunk_count
                };
            }
            else {
                this.status = "error";
                return {
                    status: "error",
                    message: result.message,
                    itemKey: result.item_key,
                    error: result.message
                };
            }
        }
        catch (error) {
            this.status = "error";
            return {
                status: "error",
                message: "Failed to index document",
                error: error.message
            };
        }
    }
    /**
     * Search for passages.
     *
     * 中文：搜索段落。
     * English: Search for passages.
     */
    async searchPassages(query, options = {}) {
        if (!this.settings.ragServiceEnabled) {
            throw new Error("RAG integration is disabled");
        }
        try {
            return await this.ragClient.searchPassages(query, options);
        }
        catch (error) {
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
    async getDocumentOutline(itemKey) {
        if (!this.settings.ragServiceEnabled) {
            throw new Error("RAG integration is disabled");
        }
        try {
            return await this.ragClient.getDocumentOutline(itemKey);
        }
        catch (error) {
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
    async getDocumentBlocks(itemKey, limit = 100, offset = 0) {
        if (!this.settings.ragServiceEnabled) {
            throw new Error("RAG integration is disabled");
        }
        try {
            return await this.ragClient.getDocumentBlocks(itemKey, limit, offset);
        }
        catch (error) {
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
    async reindexDocument(itemKey) {
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
            }
            else {
                this.status = "error";
                return {
                    status: "error",
                    message: result.message,
                    itemKey: result.item_key,
                    error: result.message
                };
            }
        }
        catch (error) {
            this.status = "error";
            return {
                status: "error",
                message: "Failed to re-index document",
                error: error.message
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
        }
        catch (error) {
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
    getSidecarDir(pdfPath, itemKey) {
        const pdfDir = dirname(pdfPath);
        return join(pdfDir, ".zotero-rag", "items", itemKey);
    }
    /**
     * Write status note to Zotero.
     *
     * 中文：向 Zotero 写入状态笔记。
     * English: Write status note to Zotero.
     */
    async writeStatusNote(itemKey, status, message) {
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
    async writeStatusTag(itemKey, status) {
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
export function createRagIntegration(settings) {
    return new RagIntegration(settings);
}
