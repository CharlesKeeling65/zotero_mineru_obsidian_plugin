export type BlockType = "text" | "figure" | "table" | "formula";

export interface BlockPageRange {
  start: number;
  end: number;
}

export interface BlockContent {
  text: string | null;
  markdown: string | null;
}

export interface Block {
  blockId: string;
  documentId: string;
  type: BlockType;
  subtype: string | null;
  sectionPath: string[];
  pageRange: BlockPageRange;
  order: number;
  content: BlockContent;
  caption: string | null;
  assetIds: string[];
  relatedBlockIds: string[];
  tags: string[];
  sourceFingerprint: string;
}
