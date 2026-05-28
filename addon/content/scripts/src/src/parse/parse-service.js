import { normalizeMineruDocument } from "../normalize/normalizer.js";
import { ensureMarkdownTextBlocks } from "./markdown-preprocessor.js";
/**
 * Orchestrates MinerU parsing and internal normalization.
 *
 * 中文核心职责：
 * - 调用 provider 发送 PDF 并获取 raw MinerU document/files。
 * - 把 raw files 写入 cache，保留可追溯的原始结果。
 * - 对 markdown 做文章级/段落级拆分，生成有序 text blocks。
 * - 调用 normalizer 生成 Document/Block/Asset/Relation/AIAnnotation 兼容的内部模型。
 *
 * English responsibilities:
 * - Ask the provider to parse the PDF.
 * - Persist raw files for traceability.
 * - Split Markdown into ordered article text blocks.
 * - Normalize the result into the repo's internal structured model.
 *
 * 框架知识点 / Framework note:
 * 这类类通常位于“use case/application layer”，负责串联领域步骤，但不应该直接
 * 写 UI、网络细节或数据库细节。这样可以保持 Zotero、MinerU、export 三层可替换。
 */
export class ParseService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    /**
     * Parse one PDF into a normalized document.
     *
     * 中文参数说明：
     * - `input.docId`：调用者提供的稳定文档 ID。
     * - `input.zoteroItemKey`：用于追溯 Zotero 条目。
     * - `input.pdfPath`：真实 PDF 路径，provider 会读取它。
     * - `input.title`：用于 normalized document 的标题和元数据。
     *
     * English: parses a single PDF and returns the normalized internal document.
     */
    async parse(input) {
        const response = await this.dependencies.provider.parsePdf(input);
        // 中文：先保存 raw files，再标准化。即使后续标准化逻辑升级，raw 结果仍可重放。
        // English: persist raw files before normalization so future normalizers can replay them.
        for (const rawFile of response.rawFiles) {
            await this.dependencies.cache.writeRawFile(rawFile.name, rawFile.content);
        }
        // 中文：MinerU markdown 不是最终 UI 模型，必须先拆块再标准化。
        // English: MinerU Markdown is not the UI model; split and normalize it first.
        return normalizeMineruDocument(ensureMarkdownTextBlocks(response.document), this.dependencies.provider.backendName);
    }
}
