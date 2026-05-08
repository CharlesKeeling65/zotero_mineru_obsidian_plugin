import type { CoreSection } from "../model/index.js";
import type { RawMineruBlock, RawMineruDocument } from "../types/mineru.js";

const ARTICLE_MARKER = /^article$/i;
const STOP_HEADING = /^(references|bibliography|works cited|acknowledg(?:e)?ments|author contributions|competing interests|supplementary)/i;
const RESULTS_DISCUSSION_HEADING = /results?\s+(and|&)\s+discussion/i;
const AVAILABILITY_HEADING = /^(reporting summary|data availability|code availability)$/i;

interface Heading {
  level: number;
  text: string;
}

export interface MarkdownToTextBlocksOptions {
  title?: string;
}

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

function parseHeading(line: string): Heading | null {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  if (!match) {
    return null;
  }

  return {
    level: match[1]?.length ?? 1,
    text: stripMarkdownInline(match[2] ?? "")
  };
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

function classifyHeading(text: string): CoreSection | null {
  const normalized = text.trim().toLowerCase();

  if (normalized === "abstract") {
    return "abstract";
  }
  if (normalized === "introduction") {
    return "introduction";
  }
  if (RESULTS_DISCUSSION_HEADING.test(normalized)) {
    return "results_discussion";
  }
  if (normalized === "results") {
    return "results";
  }
  if (normalized === "discussion") {
    return "discussion";
  }
  if (normalized.startsWith("methods")) {
    return "methods";
  }
  if (AVAILABILITY_HEADING.test(normalized)) {
    return "availability";
  }

  return null;
}

function isMetadataParagraph(text: string): boolean {
  return (
    /^(received|accepted|published online):/i.test(text) ||
    /^check for updates$/i.test(text) ||
    /\b\d+(,\d+)*\b/.test(text) && text.length < 180 && /[,&]/.test(text)
  );
}

function inferTitleSectionRole(
  text: string,
  titleSectionParagraphCount: number
): CoreSection {
  if (isMetadataParagraph(text)) {
    return "frontmatter";
  }

  if (titleSectionParagraphCount === 0) {
    return "abstract";
  }

  return "introduction";
}

export function markdownToTextBlocks(
  markdown: string,
  options: MarkdownToTextBlocksOptions = {}
): RawMineruBlock[] {
  const blocks: RawMineruBlock[] = [];
  const paragraphLines: string[] = [];
  let currentSection = options.title ?? "Article";
  let currentCoreSection: CoreSection = "other";
  let titleSection: string | null = options.title ?? null;
  let titleSectionContentBlocks = 0;

  const flush = (): void => {
    const text = makeParagraph(paragraphLines);
    paragraphLines.length = 0;

    if (!text) {
      return;
    }

    const coreSection =
      titleSection && currentSection === titleSection
        ? inferTitleSectionRole(text, titleSectionContentBlocks)
        : currentCoreSection;

    blocks.push({
      type: "text",
      section: currentSection,
      coreSection,
      pageStart: 1,
      pageEnd: 1,
      order: blocks.length + 1,
      text,
      markdown: text
    });

    if (titleSection && currentSection === titleSection && coreSection !== "frontmatter") {
      titleSectionContentBlocks += 1;
    }
  };

  for (const line of articleLines(markdown)) {
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    const heading = parseHeading(trimmed);
    if (heading) {
      flush();
      currentSection = heading.text || currentSection;

      if (heading.level === 1 && blocks.length === 0) {
        titleSection = currentSection || options.title || null;
      }

      currentCoreSection = classifyHeading(currentSection) ?? currentCoreSection;
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
    blocks: markdownToTextBlocks(raw.markdown, { title: raw.title })
  };
}
