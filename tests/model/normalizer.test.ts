import { describe, expect, it } from "vitest";

import { normalizeMineruDocument } from "../../src/normalize/normalizer.js";
import type { RawMineruDocument } from "../../src/types/mineru.js";

describe("normalizeMineruDocument", () => {
  it("creates a structured document with stable text blocks from raw MinerU data", () => {
    const raw: RawMineruDocument = {
      docId: "zotero_8ABCD123",
      zoteroItemKey: "8ABCD123",
      title: "Structured Reading",
      markdown: "# Abstract\n\nA short abstract.\n\n## Methods\n\nA method paragraph.",
      blocks: [
        {
          type: "text",
          section: "Abstract",
          coreSection: "abstract",
          pageStart: 1,
          pageEnd: 1,
          order: 1,
          text: "A short abstract."
        },
        {
          type: "text",
          section: "Methods",
          subsection: "Approach",
          pageStart: 2,
          pageEnd: 2,
          order: 2,
          text: "A method paragraph."
        }
      ]
    };
    const result = normalizeMineruDocument(raw);
    const secondPass = normalizeMineruDocument(raw);

    expect(result.document.documentId).toBe("zotero_8ABCD123");
    expect(result.document.stats.blockCount).toBe(2);
    expect(result.document.sectionTree.map((section) => section.title)).toEqual([
      "Abstract",
      "Methods"
    ]);
    expect(result.document.schemaVersion).toBe("2026-04-24");
    expect(result.blocks[0]?.blockId).toContain("zotero_8ABCD123:text:");
    expect(result.blocks[0]?.blockId).toBe(secondPass.blocks[0]?.blockId);
    expect(result.blocks[1]?.sectionPath).toEqual(["Methods", "Approach"]);
    expect(result.blocks[1]?.type).toBe("text");
    expect(result.blocks[0]?.coreSection).toBe("abstract");
  });
});
