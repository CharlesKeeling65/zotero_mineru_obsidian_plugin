import { describe, expect, it } from "vitest";

import {
  GRAY_TRANSLATION_ANNOTATION_COLOR,
  RuntimeZoteroAnnotationWriter,
  buildTranslationAnnotationPayloads
} from "../../src/zotero/annotations.js";
import type { TranslatedTextBlock } from "../../src/translate/contextual-translator.js";

describe("buildTranslationAnnotationPayloads", () => {
  it("maps paragraph translations to gray Zotero highlight annotation cards", () => {
    const translations: TranslatedTextBlock[] = [
      {
        blockId: "doc:text:intro:abc123",
        order: 3,
        pageRange: { start: 2, end: 2 },
        sectionPath: ["Introduction"],
        sourceText: "Original paragraph.",
        translation: "精准译文。"
      }
    ];

    const [annotation] = buildTranslationAnnotationPayloads(translations);

    expect(annotation).toMatchObject({
      type: "highlight",
      text: "Original paragraph.",
      comment: "精准译文。",
      color: GRAY_TRANSLATION_ANNOTATION_COLOR,
      pageLabel: "2",
      sortIndex: "00001|000003|00000",
      position: {
        pageIndex: 1,
        rects: []
      },
      tags: [{ name: "mineru-translation" }]
    });
    expect(annotation?.key).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("uses resolved Zotero Reader text-location rects when available", () => {
    const [annotation] = buildTranslationAnnotationPayloads(
      [
        {
          blockId: "block-1",
          order: 1,
          pageRange: { start: 1, end: 1 },
          sectionPath: ["Abstract"],
          sourceText: "Original paragraph.",
          translation: "精准译文。"
        }
      ],
      {
        textLocations: new Map([
          [
            "block-1",
            {
              pageIndex: 4,
              pageLabel: "5",
              rects: [[11, 22, 33, 44]]
            }
          ]
        ])
      }
    );

    expect(annotation).toMatchObject({
      pageLabel: "5",
      sortIndex: "00004|000001|00000",
      position: {
        pageIndex: 4,
        rects: [[11, 22, 33, 44]]
      }
    });
  });
});

describe("RuntimeZoteroAnnotationWriter", () => {
  it("saves annotation payloads through Zotero.Annotations.saveFromJSON", async () => {
    const saved: unknown[] = [];
    const attachment = { id: 9, libraryID: 1 };
    const writer = new RuntimeZoteroAnnotationWriter({
      attachment,
      zotero: {
        Annotations: {
          saveFromJSON: async (_attachment, annotation, options) => {
            saved.push({ attachment: _attachment, annotation, options });
            return { id: 1 };
          }
        }
      }
    });

    const created = await writer.createTranslationAnnotations([
      buildTranslationAnnotationPayloads([
        {
          blockId: "block-1",
          order: 1,
          pageRange: { start: 1, end: 1 },
          sectionPath: [],
          sourceText: "Source",
          translation: "译文"
        }
      ])[0]!
    ]);

    expect(created).toBe(1);
    expect(saved).toMatchObject([
      {
        attachment,
        annotation: {
          type: "highlight",
          text: "Source",
          comment: "译文",
          color: GRAY_TRANSLATION_ANNOTATION_COLOR
        },
        options: {
          skipSelect: true
        }
      }
    ]);
  });
});
