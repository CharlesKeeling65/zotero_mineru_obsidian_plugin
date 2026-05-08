/**
 * Coarse article-section classification used by Markdown preprocessing.
 *
 * 中文：真实论文标题并不统一，例如有的论文没有显式 Abstract/Introduction 标题，
 * 有的把 Results and Discussion 合并。因此这里使用“核心区段”枚举，帮助 UI、
 * 翻译上下文和后续 AI workflow 按文章结构组织段落。
 *
 * English: real papers use inconsistent headings. This coarse section enum lets
 * UI, translation context, and future AI workflows organize blocks by article role.
 */
export type CoreSection =
  | "frontmatter"
  | "abstract"
  | "introduction"
  | "results"
  | "results_discussion"
  | "discussion"
  | "methods"
  | "availability"
  | "other";
