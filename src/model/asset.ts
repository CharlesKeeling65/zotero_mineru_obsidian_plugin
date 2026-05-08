/**
 * File-backed resource extracted from a paper.
 *
 * 中文：Asset 用来表示图片、表格文件、公式图片或 raw 文件等“文件资源”。
 * Block 通过 `assetIds` 引用 Asset，避免把二进制/路径细节直接塞进段落模型。
 *
 * English: Asset represents file-backed resources such as extracted figures,
 * table files, formulas, or raw artifacts. Blocks reference assets by ID.
 */
export interface Asset {
  /** 中文：稳定资源 ID；English: stable resource identifier. */
  assetId: string;
  /** 中文：所属文档 ID；English: owning document identifier. */
  documentId: string;
  type: "image" | "table" | "formula" | "file";
  role: "figure" | "table" | "formula" | "raw";
  /** 中文：本地或 vault 相对路径；English: local or vault-relative path. */
  path: string;
  mimeType: string | null;
  /** 中文：产生/引用该资源的 block；English: block that produced or references this asset. */
  sourceBlockId: string;
}
