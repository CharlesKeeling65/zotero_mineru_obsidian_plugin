import type { DocumentSchemaVersion } from "./schema-version.js";

export type DocumentStatus = "pending" | "parsed" | "failed";

export interface DocumentSectionNode {
  id: string;
  title: string;
  level: number;
  path: string[];
  blockIds: string[];
}

export interface DocumentSource {
  zoteroItemKey: string;
  title: string;
}

export interface DocumentParseMetadata {
  engine: "mineru";
  backend: string;
  parsedAt: string | null;
}

export interface DocumentStats {
  blockCount: number;
  assetCount: number;
  relationCount: number;
}

export interface Document {
  schemaVersion: DocumentSchemaVersion;
  documentId: string;
  source: DocumentSource;
  parse: DocumentParseMetadata;
  title: string;
  fullMarkdown: string;
  sectionTree: DocumentSectionNode[];
  stats: DocumentStats;
  status: DocumentStatus;
}
