import { describe, expect, it } from "vitest";

import { resolvePdfSelection } from "../../src/zotero/selection.js";

describe("resolvePdfSelection", () => {
  it("uses the selected item directly when it is a pdf attachment", () => {
    const result = resolvePdfSelection({
      selectedItem: {
        key: "PDF1",
        kind: "attachment",
        contentType: "application/pdf",
        path: "/tmp/paper.pdf"
      }
    });

    expect(result.attachment.key).toBe("PDF1");
    expect(result.parentItemKey).toBeUndefined();
  });

  it("falls back to the first pdf attachment on a regular item", () => {
    const result = resolvePdfSelection({
      selectedItem: {
        key: "ITEM1",
        kind: "regular",
        attachments: [
          {
            key: "ATT1",
            kind: "attachment",
            contentType: "text/plain",
            path: "/tmp/readme.txt"
          },
          {
            key: "PDF1",
            kind: "attachment",
            contentType: "application/pdf",
            path: "/tmp/paper.pdf"
          }
        ]
      }
    });

    expect(result.attachment.key).toBe("PDF1");
    expect(result.parentItemKey).toBe("ITEM1");
  });
});
