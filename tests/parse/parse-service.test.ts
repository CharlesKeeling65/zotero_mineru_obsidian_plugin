import { describe, expect, it } from "vitest";

import { ParseService } from "../../src/parse/parse-service.js";

describe("ParseService", () => {
  it("runs the provider, persists raw outputs, and returns normalized data", async () => {
    const persisted: Array<{ name: string; content: string }> = [];

    const service = new ParseService({
      provider: {
        backendName: "agent",
        parsePdf: async () => ({
          document: {
            docId: "doc-1",
            zoteroItemKey: "ITEM1",
            title: "Example Paper",
            markdown: "# Intro\n\nExample paragraph.",
            blocks: [
              {
                type: "text",
                section: "Intro",
                pageStart: 1,
                pageEnd: 1,
                order: 1,
                text: "Example paragraph."
              }
            ]
          },
          rawFiles: [
            { name: "full.md", content: "# Intro\n\nExample paragraph." },
            { name: "raw.json", content: "{\"ok\":true}" }
          ]
        })
      },
      cache: {
        writeRawFile: async (name, content) => {
          persisted.push({ name, content });
        }
      }
    });

    const result = await service.parse({
      docId: "doc-1",
      zoteroItemKey: "ITEM1",
      pdfPath: "/tmp/example.pdf",
      title: "Example Paper"
    });

    expect(persisted).toHaveLength(2);
    expect(persisted[0]?.name).toBe("full.md");
    expect(result.document.documentId).toBe("doc-1");
    expect(result.document.source.zoteroItemKey).toBe("ITEM1");
    expect(result.blocks).toHaveLength(1);
  });
});
