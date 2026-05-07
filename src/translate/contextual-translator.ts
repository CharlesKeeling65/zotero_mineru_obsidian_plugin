import type { BlockPageRange } from "../model/index.js";
import type { NormalizedDocument } from "../normalize/normalizer.js";
import type { TranslationProvider } from "./provider.js";

export interface TranslatedTextBlock {
  blockId: string;
  order: number;
  pageRange: BlockPageRange;
  sectionPath: string[];
  sourceText: string;
  translation: string;
}

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
