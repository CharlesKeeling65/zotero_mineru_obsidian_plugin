import type { CoreSection } from "./core-section.js";

/**
 * Semantic block categories supported by the MVP.
 *
 * 中文：Block 是结构化阅读系统的最小语义单元。MVP 先支持正文、图、表、公式；
 * 后续可以在不改 Document 契约的情况下扩展更多类型。
 *
 * English: Block is the smallest semantic unit in the structured reading
 * workspace. The MVP starts with text, figures, tables, and formulas.
 */
export type BlockType = "text" | "figure" | "table" | "formula";

/**
 * 1-based page range where a block appears.
 *
 * 中文：当前 MinerU markdown 可能缺少精确页码，所以 normalizer 会先用保守默认值。
 * 后续接入 layout/page 信息后，可以把这里更新为真实页码范围。
 *
 * English: current Markdown may not include exact page data, so normalization
 * can use conservative defaults until layout/page metadata is available.
 */
export interface BlockPageRange {
  start: number;
  end: number;
}

/**
 * Raw content carried by a block.
 *
 * 中文：`text` 用于搜索/翻译/匹配；`markdown` 保留原始排版线索，便于 export。
 * English: `text` is used for search/translation/matching; `markdown` keeps
 * formatting cues for export.
 */
export interface BlockContent {
  text: string | null;
  markdown: string | null;
}

/**
 * Internal normalized block.
 *
 * 中文字段说明：
 * - `blockId`：基于结构输入生成的稳定 ID，不依赖临时数组索引。
 * - `documentId`：所属文档 ID。
 * - `type/coreSection/sectionPath/order`：用于 UI 分组、排序和导航。
 * - `sourceFingerprint`：记录源文本指纹，便于检测同一段落是否变化。
 * - `assetIds/relatedBlockIds`：连接图片、表格、公式和关系图谱的扩展点。
 *
 * English: normalized block consumed by UI, export, AI, and Zotero annotation
 * flows. Keep raw parsed content separate from derived AI annotations.
 */
export interface Block {
  blockId: string;
  documentId: string;
  type: BlockType;
  coreSection: CoreSection;
  subtype: string | null;
  sectionPath: string[];
  pageRange: BlockPageRange;
  order: number;
  content: BlockContent;
  caption: string | null;
  assetIds: string[];
  relatedBlockIds: string[];
  tags: string[];
  sourceFingerprint: string;
}
