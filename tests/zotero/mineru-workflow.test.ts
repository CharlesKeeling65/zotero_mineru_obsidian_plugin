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
});
