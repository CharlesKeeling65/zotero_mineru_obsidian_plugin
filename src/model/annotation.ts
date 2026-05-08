/**
 * AI-derived annotation stored separately from raw parsed blocks.
 *
 * 中文：AIAnnotation 不能覆盖 Block 的原文内容。它表示“派生知识”，例如总结、问题、
 * claim/evidence 标注等。这样以后切换模型或重新生成 AI 结果时，不会破坏 MinerU
 * 原始解析结果和用户手工笔记。
 *
 * English: AIAnnotation is derived content and must not mutate raw Blocks. This
 * keeps parser output, human edits, and AI-generated knowledge separated.
 */
export interface AIAnnotation {
  annotationId: string;
  documentId: string;
  /** 中文：可指向整篇文档或单个 block；English: targets either a document or a block. */
  target: {
    type: "document" | "block";
    id: string;
  };
  /** 中文：AI 结果类型；English: semantic kind of AI output. */
  kind:
    | "summary"
    | "importance_score"
    | "keywords"
    | "question"
    | "answer"
    | "method_role"
    | "claim"
    | "evidence"
    | "limitation"
    | "reproducibility_note";
  /** 中文：服务商名称，例如 openai/local；English: provider name. */
  provider: string;
  /** 中文：模型名称，用于可追溯性；English: model name for provenance. */
  model: string;
  content: string;
  createdAt: string;
}
