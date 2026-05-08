import { describe, expect, it } from "vitest";

import {
  findTextLocationForParagraph,
  resolveTextLocationsForTranslations
} from "../../src/zotero/text-location.js";
import type { TranslatedTextBlock } from "../../src/translate/contextual-translator.js";

describe("findTextLocationForParagraph", () => {
  it("finds paragraph text across reader text runs and returns page rects", () => {
    const location = findTextLocationForParagraph(
      "Manure recycling can ameliorate pollution and fertilizer demand.",
      [
        {
          pageIndex: 0,
          pageLabel: "1",
          textRuns: [
            { text: "Header text", rect: [1, 1, 9, 9] },
            { text: "Manure recycling can ", rect: [10, 10, 80, 20] },
            { text: "ameliorate pollution and fertilizer demand.", rect: [82, 10, 200, 20] }
          ]
        }
      ]
    );

    expect(location).toEqual({
      pageIndex: 0,
      pageLabel: "1",
      rects: [
        [10, 10, 80, 20],
        [82, 10, 200, 20]
      ]
    });
  });

  it("falls back to a long prefix when OCR spacing prevents a full exact match", () => {
    const text =
      "A long paragraph that should still be anchored even when the PDF text layer has additional trailing content.";
    const location = findTextLocationForParagraph(text, [
      {
        pageIndex: 2,
        pageLabel: "3",
        textRuns: [
          {
            text: "A long paragraph that should still be anchored even when the PDF text layer has additional trailing content plus a footnote marker",
            rect: [5, 15, 205, 35]
          }
        ]
      }
    ]);

    expect(location).toEqual({
      pageIndex: 2,
      pageLabel: "3",
      rects: [[5, 15, 205, 35]]
    });
  });
});

describe("resolveTextLocationsForTranslations", () => {
  it("resolves locations by translated block id", async () => {
    const translations: TranslatedTextBlock[] = [
      {
        blockId: "block-1",
        order: 1,
        pageRange: { start: 1, end: 1 },
        sectionPath: ["Abstract"],
        sourceText: "First paragraph.",
        translation: "第一段。"
      }
    ];

    const locations = await resolveTextLocationsForTranslations(translations, {
      getPages: async () => [
        {
          pageIndex: 0,
          pageLabel: "1",
          textRuns: [{ text: "First paragraph.", rect: [1, 2, 3, 4] }]
        }
      ]
    });

    expect(locations.get("block-1")).toEqual({
      pageIndex: 0,
      pageLabel: "1",
      rects: [[1, 2, 3, 4]]
    });
  });
});
