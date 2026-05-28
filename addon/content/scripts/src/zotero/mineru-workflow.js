import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { ParseService } from "../parse/parse-service.js";
import { translateDocumentTextBlocks } from "../translate/contextual-translator.js";
import { resolveTextLocationsForTranslations } from "./text-location.js";
import { buildTranslationAnnotationPayloads } from "./annotations.js";
import { resolvePdfSelection } from "./selection.js";
import { createAttachmentManager } from "./attachment-manager.js";
import { defaultLogger } from "../utils/logger.js";
/**
 * Parse cache that writes MinerU outputs beside the source PDF.
 *
 * 中文：用户要求“返回文件储存在指定条目 PDF 相同父文件夹下，并且命名和 PDF 保持一致”。
 * 这个 cache 实现了该命名策略：
 * - MinerU 返回 `full.md` 时写成 `<pdfBaseName>.md`
 * - 其它 raw 文件写成 `<pdfBaseName>.<rawSuffix>.<ext>`
 *
 * English: This cache implements the requested sibling-output convention:
 * `full.md` becomes `<pdfBaseName>.md`; other raw artifacts are namespaced
 * under the same PDF base name.
 */
class PdfSiblingParseCache {
    outputDir;
    pdfBaseName;
    constructor(outputDir, pdfBaseName) {
        this.outputDir = outputDir;
        this.pdfBaseName = pdfBaseName;
    }
    async writeRawFile(name, content) {
        // 中文：确保 PDF 父目录存在；English: make the PDF parent folder available.
        await mkdir(this.outputDir, { recursive: true });
        await writeFile(join(this.outputDir, this.resolveOutputName(name)), content, "utf8");
    }
    resolveOutputName(name) {
        const extension = extname(name);
        if (!extension) {
            // 中文：没有扩展名时只能保留 PDF 基名；English: no extension, keep the PDF base name.
            return this.pdfBaseName;
        }
        if (name.startsWith(`${this.pdfBaseName}.`)) {
            // 中文：如果上游已经按 PDF 命名，则不要重复加前缀；English: avoid double-prefixing.
            return name;
        }
        const suffix = basename(name, extension);
        // 中文：`full.md` 是主要 Markdown，直接与 PDF 同名，方便用户在文件夹中识别。
        // English: `full.md` is the main Markdown output, so it shares the PDF base name.
        return suffix === "full"
            ? `${this.pdfBaseName}${extension}`
            : `${this.pdfBaseName}.${suffix}${extension}`;
    }
}
/**
 * Core Zotero plugin workflow.
 *
 * 中文流程：
 * 1. 从 Zotero 当前选择解析出 PDF attachment。
 * 2. 用 PDF 父目录创建 cache，保证 MinerU 原始结果写回同一文件夹。
 * 3. 调用 ParseService：MinerU 解析 -> 写 raw 文件 -> Markdown 分块 -> 内部模型标准化。
 * 4. 如果配置了翻译和注释 writer，则逐段翻译，再尽量用 Reader text location 找到 PDF rects。
 * 5. 构造 Zotero highlight annotation payload，并写入 Zotero 侧边注释栏。
 *
 * English flow:
 * 1. Resolve the selected Zotero PDF attachment.
 * 2. Create a sibling parse cache rooted at the PDF parent folder.
 * 3. Run ParseService: MinerU parse -> raw persistence -> Markdown block split -> normalization.
 * 4. If translation and annotation writer are configured, translate blocks and resolve PDF rects.
 * 5. Build Zotero highlight annotations and write them into the reader sidebar.
 *
 * 后续开发 / Future extension:
 * - 接入真实 Zotero runtime 时，只需实现 `TranslationAnnotationWriter` 和
 *   `ZoteroReaderTextLocationProvider`，不要把 runtime 细节塞进 normalize/parse 层。
 * - Export、UI、AI agent 应消费 `NormalizedDocument`，不要直接消费 MinerU raw JSON。
 */
export async function parseSelectedPdfWithMineru(input) {
    defaultLogger.info("开始 Zotero MinerU 工作流", {
        title: input.title,
        providerBackend: input.provider.backendName,
        hasTranslation: !!input.translationProvider,
        hasRag: !!input.ragIntegration,
        hasAttachmentManager: !!input.attachmentManagerConfig
    });
    // 中文：Zotero 可能选中父条目或 PDF attachment；selection 层负责兼容这些形态。
    // English: selection layer supports either parent item or direct PDF attachment selection.
    const selection = resolvePdfSelection({ selectedItem: input.selectedItem });
    const pdfPath = selection.attachment.path;
    const outputDir = dirname(pdfPath);
    const pdfBaseName = basename(pdfPath, extname(pdfPath));
    // 中文：优先使用父条目的 key 做 document identity，attachment key 作为 fallback。
    // English: prefer parent item key for document identity; fallback to attachment key.
    const zoteroItemKey = selection.parentItemKey ?? selection.attachment.key;
    defaultLogger.info("PDF 选择解析完成", { pdfPath, zoteroItemKey, outputDir });
    const service = new ParseService({
        provider: input.provider,
        cache: new PdfSiblingParseCache(outputDir, pdfBaseName)
    });
    defaultLogger.info("开始 MinerU 解析服务", { pdfPath, title: input.title });
    const normalized = await service.parse({
        docId: `zotero_${zoteroItemKey}`,
        zoteroItemKey,
        pdfPath,
        title: input.title
    });
    defaultLogger.info("MinerU 解析完成", {
        docId: normalized.document.documentId,
        blockCount: normalized.blocks.length,
    });
    if (input.translationProvider && input.annotationWriter) {
        // 中文：翻译是可选增强层；它读取 block，不修改 raw block 内容，符合 AI 输出分离原则。
        // English: translation is an optional derived layer; it does not mutate raw block content.
        defaultLogger.info("开始文档翻译", { blockCount: normalized.blocks.length });
        const translations = await translateDocumentTextBlocks(normalized, input.translationProvider);
        defaultLogger.info("文档翻译完成", { translationCount: translations.length });
        // 中文：只有 provider 存在时才尝试精确定位 PDF rects；没有 rects 时仍可生成注释 payload。
        // English: exact PDF rect matching is attempted only when a location provider is supplied.
        const textLocations = input.textLocationProvider
            ? await resolveTextLocationsForTranslations(translations, input.textLocationProvider)
            : undefined;
        // 中文：payload 构造与 Zotero 写入分离，方便测试 sortIndex/color/tags/position。
        // English: payload construction is separate from runtime writes for testability.
        const annotations = buildTranslationAnnotationPayloads(translations, {
            textLocations
        });
        const createdCount = await input.annotationWriter.createTranslationAnnotations(annotations);
        // 中文：如果配置了 RAG 集成，则索引文档到 RAG 服务。
        // English: If RAG integration is configured, index document to RAG service.
        let ragIntegrationResult;
        if (input.ragIntegration) {
            defaultLogger.info("开始 RAG 集成索引", { pdfPath, zoteroItemKey });
            try {
                ragIntegrationResult = await input.ragIntegration.indexDocument(normalized, pdfPath);
                defaultLogger.info("RAG 集成完成", { status: ragIntegrationResult.status });
            }
            catch (error) {
                console.error("RAG integration failed:", error);
                defaultLogger.error("RAG 集成失败", { error: error.message });
                ragIntegrationResult = {
                    status: "error",
                    message: "RAG integration failed",
                    error: error.message
                };
            }
        }
        return {
            normalized,
            outputDir,
            translationAnnotations: {
                annotations,
                createdCount
            },
            ragIntegration: ragIntegrationResult
        };
    }
    // 中文：如果没有翻译，但配置了 RAG 集成，则索引文档到 RAG 服务。
    // English: If no translation but RAG integration is configured, index document to RAG service.
    let ragIntegrationResult;
    if (input.ragIntegration) {
        try {
            ragIntegrationResult = await input.ragIntegration.indexDocument(normalized, pdfPath);
        }
        catch (error) {
            console.error("RAG integration failed:", error);
            ragIntegrationResult = {
                status: "error",
                message: "RAG integration failed",
                error: error.message
            };
        }
    }
    // 中文：如果配置了附件管理器，则将解析结果文件添加到 Zotero 条目。
    // English: If attachment manager is configured, add parse result files to Zotero item.
    let attachmentResult;
    if (input.attachmentManagerConfig) {
        defaultLogger.info("开始附件管理", { zoteroItemKey });
        try {
            const attachmentManager = createAttachmentManager(input.attachmentManagerConfig);
            const addedCount = await attachmentManager.addMineruFilesToItem(zoteroItemKey, [], // rawFiles not available on NormalizedDocument
            pdfPath);
            const stats = await attachmentManager.getAttachmentStats(zoteroItemKey);
            defaultLogger.info("附件管理完成", { addedCount, totalAttachments: stats.total });
            attachmentResult = {
                addedCount,
                stats
            };
        }
        catch (error) {
            console.error("Attachment management failed:", error);
            defaultLogger.error("附件管理失败", { error: error.message });
            attachmentResult = {
                addedCount: 0,
                stats: { total: 0, byType: {} }
            };
        }
    }
    return { normalized, outputDir, ragIntegration: ragIntegrationResult, attachments: attachmentResult };
}
