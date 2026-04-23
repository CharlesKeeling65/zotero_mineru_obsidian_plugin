import type { RawMineruDocument, RawMineruFile } from "../types/mineru.js";

export interface ParsePdfInput {
  docId: string;
  zoteroItemKey: string;
  pdfPath: string;
  title: string;
}

export interface ParsePdfOutput {
  document: RawMineruDocument;
  rawFiles: RawMineruFile[];
}

export interface MineruProvider {
  readonly backendName: string;
  parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput>;
}
