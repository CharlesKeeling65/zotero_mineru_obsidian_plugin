import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { ensureMarkdownTextBlocks } from "../../src/parse/markdown-preprocessor.js";
import type { RawMineruDocument } from "../../src/types/mineru.js";

const REAL_MINERU_MARKDOWN_PATH =
  process.env.REAL_MINERU_MARKDOWN_PATH ??
  "/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md";

const realMarkdownIt = existsSync(REAL_MINERU_MARKDOWN_PATH) ? it : it.skip;

describe("ensureMarkdownTextBlocks", () => {
  realMarkdownIt("splits the real MinerU markdown into ordered paragraph text blocks", async () => {
    const markdown = await readFile(REAL_MINERU_MARKDOWN_PATH, "utf8");
    const raw: RawMineruDocument = {
      docId: "zotero_PDF1",
      zoteroItemKey: "PDF1",
      title:
        "A framework for estimating manure nitrogen balance and recycling potential for current and future conditions in the USA",
      markdown,
      blocks: []
    };

    const result = ensureMarkdownTextBlocks(raw);

    expect(result.blocks).toHaveLength(102);
    expect(result.blocks[0]).toMatchObject({
      type: "text",
      section:
        "A framework for estimating manure nitrogen balance and recycling potential for current and future conditions in the USA",
      pageStart: 1,
      pageEnd: 1,
      order: 1,
      text: "Received: 9 January 2025"
    });
    expect(result.blocks[5]?.text).toContain(
      "Manure recycling can ameliorate pollution and fertilizer demand"
    );
    expect(result.blocks[13]).toMatchObject({
      type: "text",
      section: "Divergent estimates in evaluating manure recycling",
      order: 14
    });
    expect(result.blocks.at(-1)).toMatchObject({
      type: "text",
      section: "Code availability",
      order: 102,
      text:
        "The code developed in this study is available via GitHub at https:// github.com/yanyu0729/manurerecycling."
    });
    expect(result.blocks.some((block) => block.section === "References")).toBe(false);
  });

  it("keeps provider-supplied blocks unchanged", () => {
    const raw: RawMineruDocument = {
      docId: "zotero_PDF1",
      zoteroItemKey: "PDF1",
      title: "Paper Title",
      markdown: "Article\n\nA paragraph.",
      blocks: [
        {
          type: "text",
          section: "Existing",
          pageStart: 3,
          pageEnd: 3,
          order: 7,
          text: "Existing provider block."
        }
      ]
    };

    expect(ensureMarkdownTextBlocks(raw).blocks).toBe(raw.blocks);
  });
});
