import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { parseSelectedPdfWithMineru } from "../../src/zotero/mineru-workflow.js";

describe("parseSelectedPdfWithMineru", () => {
  it("stores MinerU returned files beside the selected PDF using the PDF base name", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "zotero-mineru-"));
    const pdfPath = join(tmp, "selected-paper.pdf");
    await writeFile(pdfPath, "%PDF-1.7", "utf8");

    const result = await parseSelectedPdfWithMineru({
      selectedItem: {
        key: "PDF1",
        kind: "attachment",
        contentType: "application/pdf",
        path: pdfPath
      },
      provider: {
        backendName: "agent",
        parsePdf: async () => ({
          document: {
            docId: "zotero_PDF1",
            zoteroItemKey: "PDF1",
            title: "Selected Paper",
            markdown: "# Selected Paper\n",
            blocks: []
          },
          rawFiles: [
            { name: "selected-paper.md", content: "# Selected Paper\n" }
          ]
        })
      },
      title: "Selected Paper"
    });

    expect(result.outputDir).toBe(tmp);
    expect(result.normalized.document.documentId).toBe("zotero_PDF1");
    await expect(readFile(join(tmp, "selected-paper.md"), "utf8")).resolves.toBe(
      "# Selected Paper\n"
    );
  });

  it("translates generated paragraph blocks and creates Zotero annotation cards when adapters are supplied", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "zotero-mineru-"));
    const pdfPath = join(tmp, "selected-paper.pdf");
    await writeFile(pdfPath, "%PDF-1.7", "utf8");
    const savedAnnotations: unknown[] = [];

    const result = await parseSelectedPdfWithMineru({
      selectedItem: {
        key: "PDF1",
        kind: "attachment",
        contentType: "application/pdf",
        path: pdfPath
      },
      provider: {
        backendName: "agent",
        parsePdf: async () => ({
          document: {
            docId: "zotero_PDF1",
            zoteroItemKey: "PDF1",
            title: "Selected Paper",
            markdown: "Article\n\n# Abstract\n\nFirst paragraph.\n\nSecond paragraph.",
            blocks: []
          },
          rawFiles: []
        })
      },
      title: "Selected Paper",
      translationProvider: {
        translateParagraph: async ({ text, previousParagraph, nextParagraph }) =>
          `译文:${previousParagraph ?? "START"}|${text}|${nextParagraph ?? "END"}`
      },
      textLocationProvider: {
        getPages: async () => [
          {
            pageIndex: 0,
            pageLabel: "1",
            textRuns: [
              { text: "First paragraph.", rect: [1, 2, 3, 4] },
              { text: "Second paragraph.", rect: [5, 6, 7, 8] }
            ]
          }
        ]
      },
      annotationWriter: {
        createTranslationAnnotations: async (annotations) => {
          savedAnnotations.push(...annotations);
          return annotations.length;
        }
      }
    });

    expect(result.normalized.blocks.map((block) => block.content.text)).toEqual([
      "First paragraph.",
      "Second paragraph."
    ]);
    expect(result.translationAnnotations?.createdCount).toBe(2);
    expect(savedAnnotations).toMatchObject([
      {
        type: "highlight",
        text: "First paragraph.",
        comment: "译文:START|First paragraph.|Second paragraph.",
        color: "#aaaaaa",
        position: {
          pageIndex: 0,
          rects: [[1, 2, 3, 4]]
        }
      },
      {
        type: "highlight",
        text: "Second paragraph.",
        comment: "译文:First paragraph.|Second paragraph.|END",
        color: "#aaaaaa",
        position: {
          pageIndex: 0,
          rects: [[5, 6, 7, 8]]
        }
      }
    ]);
  });
});
