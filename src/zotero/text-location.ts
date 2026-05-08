import type { TranslatedTextBlock } from "../translate/contextual-translator.js";

/**
 * PDF rectangle from Zotero Reader.
 *
 * 中文：Zotero/PDF.js 通常用数组表达矩形坐标。当前保持 `number[]`，
 * 是为了兼容不同 Reader 版本；后续如果确认格式，可收窄成 `[x1, y1, x2, y2]`。
 *
 * English: Zotero/PDF.js often represents rectangles as numeric arrays. Keep it
 * broad for runtime compatibility; narrow later when the exact version contract is confirmed.
 */
export type ZoteroPdfRect = number[];

/**
 * One text run from a PDF page.
 *
 * 中文：text run 是 PDF 文本层中一小段连续文本及其矩形位置。
 * 后续 live Zotero Reader adapter 需要把 Reader 内部文本层转换为这个结构。
 *
 * English: a text run is a short text segment plus its rectangle on one PDF page.
 */
export interface ZoteroReaderTextRun {
  text: string;
  rect: ZoteroPdfRect;
}

/**
 * Text runs for one page.
 *
 * 中文：`pageIndex` 是 0-based，用于 Zotero/PDF.js 内部定位；
 * `pageLabel` 是用户看到的页码标签。
 *
 * English: `pageIndex` is 0-based for internal APIs; `pageLabel` is user-facing.
 */
export interface ZoteroReaderPageText {
  pageIndex: number;
  pageLabel: string;
  textRuns: ZoteroReaderTextRun[];
}

/**
 * Resolved paragraph location in the Reader.
 *
 * 中文：这是 annotation payload 的 `position` 数据来源。
 * 一个段落可能跨多个 text runs，因此 `rects` 是数组。
 *
 * English: source for annotation `position`. A paragraph can span multiple text runs.
 */
export interface ZoteroTextLocation {
  pageIndex: number;
  pageLabel: string;
  rects: ZoteroPdfRect[];
}

/**
 * Provider interface for getting PDF text-layer data from Zotero Reader.
 *
 * 中文：当前核心算法不直接依赖 Zotero runtime。真实插件中需要实现这个接口：
 * 从当前打开的 PDF Reader 提取每页 text runs 和 rects。
 *
 * English: the matching algorithm is runtime-independent. A real Zotero plugin
 * adapter should implement this interface by reading the active Reader text layer.
 */
export interface ZoteroReaderTextLocationProvider {
  getPages(): Promise<ZoteroReaderPageText[]>;
}

interface IndexedTextRun {
  start: number;
  end: number;
  rect: ZoteroPdfRect;
}

function normalizeForSearch(value: string): string {
  // 中文：搜索匹配时移除标点/空白/符号，降低 PDF 文本层断词、换行、标点差异的影响。
  // English: remove punctuation/whitespace/symbols to tolerate PDF text-layer quirks.
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

/**
 * Find where a normalized paragraph starts in normalized page text.
 *
 * 中文：优先完整匹配；如果全文因 OCR/脚注差异不完全一致，则用长前缀兜底。
 * 这里的前缀策略保守，只对长段落启用，避免短句误匹配。
 *
 * English: prefer exact match; fall back to a long prefix for OCR/footnote noise.
 * The fallback is restricted to long paragraphs to reduce false positives.
 */
function findMatchStart(pageText: string, paragraphText: string): number {
  const exactMatch = pageText.indexOf(paragraphText);
  if (exactMatch >= 0) {
    return exactMatch;
  }

  if (paragraphText.length < 80) {
    return -1;
  }

  return pageText.indexOf(paragraphText.slice(0, 160));
}

/**
 * Locate one paragraph on Reader pages.
 *
 * 中文算法思路：
 * 1. 把段落和每页 text runs 都 normalize；
 * 2. 拼接每页 normalized text，同时记录每个 run 在拼接字符串里的 start/end；
 * 3. 找到段落匹配区间；
 * 4. 返回与匹配区间重叠的 run rects。
 *
 * English algorithm:
 * 1. normalize paragraph and page runs;
 * 2. concatenate page text while indexing each run range;
 * 3. find the paragraph match;
 * 4. return rects for runs overlapping the match.
 */
export function findTextLocationForParagraph(
  paragraphText: string,
  pages: ZoteroReaderPageText[]
): ZoteroTextLocation | null {
  const normalizedParagraph = normalizeForSearch(paragraphText);
  if (!normalizedParagraph) {
    return null;
  }

  for (const page of pages) {
    let normalizedPageText = "";
    const indexedRuns: IndexedTextRun[] = [];

    for (const run of page.textRuns) {
      const normalizedRunText = normalizeForSearch(run.text);
      if (!normalizedRunText) {
        continue;
      }

      const start = normalizedPageText.length;
      normalizedPageText += normalizedRunText;

      // 中文：记录 run 在拼接文本中的范围，后续才能从字符匹配反查 PDF rect。
      // English: keep text range for mapping a character match back to PDF rectangles.
      indexedRuns.push({
        start,
        end: normalizedPageText.length,
        rect: run.rect
      });
    }

    const matchStart = findMatchStart(normalizedPageText, normalizedParagraph);
    if (matchStart < 0) {
      continue;
    }

    const matchEnd = matchStart + Math.min(normalizedParagraph.length, 160);
    // 中文：取所有与匹配文本区间相交的 rect，形成 Zotero highlight 的位置。
    // English: collect rects whose runs overlap the matched text interval.
    const rects = indexedRuns
      .filter((run) => run.end > matchStart && run.start < matchEnd)
      .map((run) => run.rect);

    if (rects.length === 0) {
      continue;
    }

    return {
      pageIndex: page.pageIndex,
      pageLabel: page.pageLabel,
      rects
    };
  }

  return null;
}

/**
 * Resolve Reader locations for all translated blocks.
 *
 * 中文：返回 Map，以 `blockId` 为 key，方便 annotation builder 对每段译文查 rects。
 * 没找到位置的 block 不写入 Map，annotation 层会退回空 rects。
 *
 * English: returns a `blockId -> location` map. Missing matches are omitted so
 * annotation creation can gracefully fall back to empty rects.
 */
export async function resolveTextLocationsForTranslations(
  translations: TranslatedTextBlock[],
  provider: ZoteroReaderTextLocationProvider
): Promise<Map<string, ZoteroTextLocation>> {
  const pages = await provider.getPages();
  const locations = new Map<string, ZoteroTextLocation>();

  for (const translation of translations) {
    const location = findTextLocationForParagraph(translation.sourceText, pages);
    if (location) {
      locations.set(translation.blockId, location);
    }
  }

  return locations;
}
