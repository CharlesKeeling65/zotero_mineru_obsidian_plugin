import { describe, expect, it } from "vitest";

import { ensureMarkdownTextBlocks } from "../../src/parse/markdown-preprocessor.js";
import type { RawMineruDocument } from "../../src/types/mineru.js";

describe("ensureMarkdownTextBlocks", () => {
  it("splits the article markdown into ordered paragraph text blocks", () => {
    const raw: RawMineruDocument = {
      docId: "zotero_PDF1",
      zoteroItemKey: "PDF1",
      title: "Paper Title",
      markdown: [
        "Article",
        "",
        "# Paper Title",
        "",
        "The first article paragraph.",
        "",
        "It continues with a second paragraph.",
        "",
        "## Methods",
        "",
        "A method paragraph with context.",
        "",
        "| a | b |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "# References",
        "",
        "A reference that must not become a block."
      ].join("\n"),
      blocks: []
    };

    const result = ensureMarkdownTextBlocks(raw);

    expect(result.blocks.map((block) => block.text)).toEqual([
      "The first article paragraph.",
      "It continues with a second paragraph.",
      "A method paragraph with context."
    ]);
    expect(result.blocks.map((block) => block.order)).toEqual([1, 2, 3]);
    expect(result.blocks[0]?.section).toBe("Paper Title");
    expect(result.blocks[2]?.section).toBe("Methods");
    expect(result.blocks.every((block) => block.type === "text")).toBe(true);
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
