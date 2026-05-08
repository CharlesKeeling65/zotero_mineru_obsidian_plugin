import type { BlockPageRange } from "../model/index.js";
import type { NormalizedDocument } from "../normalize/normalizer.js";
import type { TranslationProvider } from "./provider.js";

/**
 * Result of translating one normalized text block.
 *
 * 中文：保留 `blockId` 是为了后续把译文、Zotero rects、注释 payload 对回同一个 block。
 * English: keep `blockId` so translation, rects, and annotation payloads can be joined later.
 */
export interface TranslatedTextBlock {
  blockId: string;
  order: number;
  pageRange: BlockPageRange;
  sectionPath: string[];
  sourceText: string;
  translation: string;
}

/**
 * Translate all text blocks in document order.
 *
 * 中文主流程：
 * 1. 从 normalized blocks 中筛出 text block；
 * 2. 按 `order` 排序，避免对象顺序变化影响阅读顺序；
 * 3. 对每段构造上下文请求；
 * 4. 收集译文和原文，供 Zotero annotation 层使用。
 *
 * English workflow:
 * 1. select normalized text blocks;
 * 2. sort by explicit order;
 * 3. call the translation provider with global/local context;
 * 4. return source+translation pairs for annotation creation.
 *
 * Development note:
 * 中文：如果未来要并发翻译，可以在这里加入队列和速率限制，但要保持输出 order。
 * English: future concurrency/rate-limiting belongs here, while preserving output order.
 */
export async function translateDocumentTextBlocks(
  normalized: NormalizedDocument,
  provider: TranslationProvider
): Promise<TranslatedTextBlock[]> {
  const textBlocks = normalized.blocks
    .filter((block) => block.type === "text" && Boolean(block.content.text?.trim()))
    .sort((left, right) => left.order - right.order);

  const translations: TranslatedTextBlock[] = [];

  for (const [index, block] of textBlocks.entries()) {
    const sourceText = block.content.text?.trim();
    if (!sourceText) {
      continue;
    }

    const previousParagraph = textBlocks[index - 1]?.content.text?.trim() ?? null;
    const nextParagraph = textBlocks[index + 1]?.content.text?.trim() ?? null;

    // 中文：这里把“全文背景 + 相邻段落”传入 provider，提高学术术语一致性。
    // English: pass global and neighbor context for better terminology consistency.
    const translation = await provider.translateParagraph({
      text: sourceText,
      fullDocumentMarkdown: normalized.document.fullMarkdown,
      documentTitle: normalized.document.title,
      sectionPath: block.sectionPath,
      previousParagraph,
      nextParagraph,
      order: block.order
    });

    translations.push({
      blockId: block.blockId,
      order: block.order,
      pageRange: block.pageRange,
      sectionPath: block.sectionPath,
      sourceText,
      translation
    });
  }

  return translations;
}
