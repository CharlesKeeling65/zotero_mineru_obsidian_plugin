export interface PdfAttachment {
  key: string;
  kind: "attachment";
  contentType: string;
  path: string;
}

export function isPdfAttachment(
  attachment: PdfAttachment | { contentType: string }
): attachment is PdfAttachment {
  return attachment.contentType === "application/pdf";
}
