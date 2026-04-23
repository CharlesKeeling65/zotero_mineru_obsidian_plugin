export interface RawMineruBlock {
  type: "text" | "figure" | "table" | "formula";
  section: string;
  subsection?: string;
  pageStart: number;
  pageEnd: number;
  order: number;
  text?: string;
  markdown?: string;
  caption?: string;
}

export interface RawMineruDocument {
  docId: string;
  zoteroItemKey: string;
  title: string;
  markdown: string;
  blocks: RawMineruBlock[];
}

export interface RawMineruFile {
  name: string;
  content: string;
}
