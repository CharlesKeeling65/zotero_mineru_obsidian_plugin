export interface Asset {
  assetId: string;
  documentId: string;
  type: "image" | "table" | "formula" | "file";
  role: "figure" | "table" | "formula" | "raw";
  path: string;
  mimeType: string | null;
  sourceBlockId: string;
}
