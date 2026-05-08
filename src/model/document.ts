import type { DocumentSchemaVersion } from "./schema-version.js";

/**
 * Lifecycle status of a structured paper document.
 *
 * 中文：UI 可以根据状态显示“等待解析/已完成/失败”。不要把错误详情塞到 status；
 * 未来可单独增加 error object。
 *
 * English: UI can use this to render pending/parsed/failed states. Keep detailed
 * errors in a separate structure if needed later.
 */
export type DocumentStatus = "pending" | "parsed" | "failed";

/**
 * One section node in the document outline.
 *
 * 中文：`path` 表示从顶层到当前标题的标题链；`blockIds` 表示该 section 下直接归属
 * 的 block。这样 Outline tab 可以按树导航，Cards tab 可以按 block 顺序展示。
 *
 * English: `path` is the heading chain and `blockIds` are the blocks assigned
 * to the section. This supports both outline navigation and card browsing.
 */
export interface DocumentSectionNode {
  id: string;
  title: string;
  level: number;
  path: string[];
  blockIds: string[];
}

/**
 * Source metadata for traceability back to Zotero.
 *
 * 中文：结构化数据必须能追溯回 Zotero 条目，后续 export/AI 结果也依赖这个来源信息。
 * English: every normalized document must remain traceable to its Zotero source.
 */
export interface DocumentSource {
  zoteroItemKey: string;
  title: string;
}

/**
 * Parse provenance.
 *
 * 中文：记录解析引擎和 provider 来源，便于以后比较 Agent API、Standard API、本地后端
 * 的结果差异。
 *
 * English: captures parser provenance so future backends can be compared.
 */
export interface DocumentParseMetadata {
  engine: "mineru";
  backend: string;
  parsedAt: string | null;
}

/**
 * Lightweight aggregate counts.
 *
 * 中文：UI/export 可以先读 stats，而不必遍历所有 block/asset/relation。
 * English: lets UI/export show summary counts without scanning all entities.
 */
export interface DocumentStats {
  blockCount: number;
  assetCount: number;
  relationCount: number;
}

/**
 * Normalized structured paper document.
 *
 * 中文：Document 是“纸张级”的聚合根，保存标题、全文 markdown、section tree 和统计；
 * 具体段落/图表/公式内容在 Block/Asset/Relation 中。这样顶层模型不会变成巨型对象。
 *
 * English: document-level aggregate containing title, full Markdown, outline,
 * and stats. Detailed semantic units live in Block/Asset/Relation.
 */
export interface Document {
  schemaVersion: DocumentSchemaVersion;
  documentId: string;
  source: DocumentSource;
  parse: DocumentParseMetadata;
  title: string;
  fullMarkdown: string;
  sectionTree: DocumentSectionNode[];
  stats: DocumentStats;
  status: DocumentStatus;
}
