import type { TranslatedTextBlock } from "../translate/contextual-translator.js";

export type ZoteroPdfRect = number[];

export interface ZoteroReaderTextRun {
  text: string;
  rect: ZoteroPdfRect;
}

export interface ZoteroReaderPageText {
  pageIndex: number;
  pageLabel: string;
  textRuns: ZoteroReaderTextRun[];
}

export interface ZoteroTextLocation {
  pageIndex: number;
  pageLabel: string;
  rects: ZoteroPdfRect[];
}

export interface ZoteroReaderTextLocationProvider {
  getPages(): Promise<ZoteroReaderPageText[]>;
}

interface IndexedTextRun {
  start: number;
  end: number;
  rect: ZoteroPdfRect;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

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
