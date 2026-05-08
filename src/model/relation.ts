/**
 * Relationship categories between blocks.
 *
 * 中文：Relation 是未来知识图谱和 AI 推理的基础。MVP 先自动生成 `precedes/follows`
 * 这类确定性顺序关系；`explains/evidence_for/derived_from` 等可由后续 AI 或人工流程生成。
 *
 * English: Relation is the foundation for future knowledge-graph and AI
 * workflows. The MVP can generate deterministic ordering relations first.
 */
export type RelationType =
  | "belongs_to_section"
  | "precedes"
  | "follows"
  | "explains"
  | "refers_to"
  | "caption_of"
  | "evidence_for"
  | "derived_from";

/**
 * Directed relation between two blocks.
 *
 * 中文字段说明：
 * - `sourceBlockId` -> `targetBlockId` 表示有方向的关系。
 * - `confidence` 用 0-1 数字表示可靠度；系统确定性关系通常为 1。
 * - `provenance` 区分 system/ai/human，避免把 AI 推断伪装成原始解析事实。
 *
 * English: directed relation with confidence and provenance. Provenance keeps
 * system facts, AI output, and human edits separate.
 */
export interface Relation {
  relationId: string;
  documentId: string;
  sourceBlockId: string;
  targetBlockId: string;
  type: RelationType;
  confidence: number;
  provenance: "system" | "ai" | "human";
}
