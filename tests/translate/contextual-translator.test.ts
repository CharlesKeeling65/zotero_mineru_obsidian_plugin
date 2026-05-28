import { describe, expect, it } from "vitest";

import { translateDocumentTextBlocks } from "../../src/translate/contextual-translator.js";
import type { NormalizedDocument } from "../../src/normalize/normalizer.js";

describe("translateDocumentTextBlocks", () => {
  it("translates each text block with full-document and neighbor context", async () => {
    const normalized: NormalizedDocument = {
      document: {
        schemaVersion: "2026-04-24",
        documentId: "doc-1",
        source: {
          zoteroItemKey: "PDF1",
          title: "Contextual Translation"
        },
        parse: {
          engine: "mineru",
          backend: "agent",
          parsedAt: null
        },
        title: "Contextual Translation",
        fullMarkdown: "Article\n\nFirst paragraph.\n\nSecond paragraph.",
        sectionTree: [],
        stats: {
          blockCount: 2,
          chunkCount: 0,
          assetCount: 0,
          relationCount: 1
        },
        status: "parsed"
      },
      blocks: [
        {
          blockId: "block-1",
          documentId: "doc-1",
          type: "text",
          coreSection: "abstract",
          subtype: null,
          sectionPath: ["Abstract"],
          pageRange: { start: 1, end: 1 },
          order: 1,
          content: { text: "First paragraph.", markdown: "First paragraph." },
          caption: null,
          assetIds: [],
          relatedBlockIds: [],
          tags: [],
          sourceFingerprint: "a"
        },
        {
          blockId: "block-2",
          documentId: "doc-1",
          type: "text",
          coreSection: "abstract",
          subtype: null,
          sectionPath: ["Abstract"],
          pageRange: { start: 1, end: 1 },
          order: 2,
          content: { text: "Second paragraph.", markdown: "Second paragraph." },
          caption: null,
          assetIds: [],
          relatedBlockIds: [],
          tags: [],
          sourceFingerprint: "b"
        }
      ],
      assets: [],
      relations: []
    };
    const requests: unknown[] = [];

    const translations = await translateDocumentTextBlocks(normalized, {
      translateParagraph: async (request) => {
        requests.push(request);
        return `译文：${request.text}`;
      }
    });

    expect(translations.map((translation) => translation.translation)).toEqual([
      "译文：First paragraph.",
      "译文：Second paragraph."
    ]);
    expect(requests).toMatchObject([
      {
        text: "First paragraph.",
        fullDocumentMarkdown: normalized.document.fullMarkdown,
        previousParagraph: null,
        nextParagraph: "Second paragraph.",
        sectionPath: ["Abstract"]
      },
      {
        text: "Second paragraph.",
        previousParagraph: "First paragraph.",
        nextParagraph: null,
        sectionPath: ["Abstract"]
      }
    ]);
  });
});
