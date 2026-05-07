import type { RawMineruBlock, RawMineruDocument } from "../types/mineru.js";

const ARTICLE_MARKER = /^article$/i;
const STOP_HEADING = /^(references|bibliography|works cited|acknowledg(?:e)?ments|author contributions|competing interests|supplementary)/i;

function stripMarkdownInline(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+\S/.test(line.trim());
}

function headingText(line: string): string {
  return stripMarkdownInline(line.trim().replace(/^#{1,6}\s+/, ""));
}

function isTableParagraph(lines: string[]): boolean {
  return lines.length > 0 && lines.every((line) => /^\s*\|.*\|\s*$/.test(line));
}

function makeParagraph(textLines: string[]): string | null {
  if (textLines.length === 0 || isTableParagraph(textLines)) {
    return null;
  }

  const text = stripMarkdownInline(textLines.join(" "));
  return text.length > 0 ? text : null;
}

function articleLines(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const articleIndex = lines.findIndex((line) => ARTICLE_MARKER.test(line.trim()));
  const startIndex = articleIndex >= 0 ? articleIndex + 1 : 0;
  const selected = lines.slice(startIndex);
  const stopIndex = selected.findIndex((line) => {
    if (!isHeading(line)) {
      return false;
    }

    return STOP_HEADING.test(headingText(line));
  });

  return stopIndex >= 0 ? selected.slice(0, stopIndex) : selected;
}

export function markdownToTextBlocks(markdown: string): RawMineruBlock[] {
  const blocks: RawMineruBlock[] = [];
  const paragraphLines: string[] = [];
  let currentSection = "Article";

  const flush = (): void => {
    const text = makeParagraph(paragraphLines);
    paragraphLines.length = 0;

    if (!text) {
      return;
    }

    blocks.push({
      type: "text",
      section: currentSection,
      pageStart: 1,
      pageEnd: 1,
      order: blocks.length + 1,
      text,
      markdown: text
    });
  };

  for (const line of articleLines(markdown)) {
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    if (isHeading(trimmed)) {
      flush();
      currentSection = headingText(trimmed) || currentSection;
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flush();
  return blocks;
}

export function ensureMarkdownTextBlocks(raw: RawMineruDocument): RawMineruDocument {
  if (raw.blocks.length > 0) {
    return raw;
  }

  return {
    ...raw,
    blocks: markdownToTextBlocks(raw.markdown)
  };
}
