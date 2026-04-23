import { isPdfAttachment, type PdfAttachment } from "./attachment.js";

export interface ZoteroRegularItem {
  key: string;
  kind: "regular";
  attachments: PdfAttachment[];
}

export interface ZoteroSelectedAttachment extends PdfAttachment {
  kind: "attachment";
}

export interface ResolvePdfSelectionInput {
  selectedItem: ZoteroRegularItem | ZoteroSelectedAttachment;
}

export interface ResolvedPdfSelection {
  attachment: PdfAttachment;
  parentItemKey?: string;
}

export function resolvePdfSelection(
  input: ResolvePdfSelectionInput
): ResolvedPdfSelection {
  if (input.selectedItem.kind === "attachment") {
    if (!isPdfAttachment(input.selectedItem)) {
      throw new Error("Selected attachment is not a PDF.");
    }

    return { attachment: input.selectedItem };
  }

  const attachment = input.selectedItem.attachments.find(isPdfAttachment);
  if (!attachment) {
    throw new Error("No PDF attachment found on the selected Zotero item.");
  }

  return {
    attachment,
    parentItemKey: input.selectedItem.key
  };
}
