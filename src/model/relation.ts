export type RelationType =
  | "belongs_to_section"
  | "precedes"
  | "follows"
  | "explains"
  | "refers_to"
  | "caption_of"
  | "evidence_for"
  | "derived_from";

export interface Relation {
  relationId: string;
  documentId: string;
  sourceBlockId: string;
  targetBlockId: string;
  type: RelationType;
  confidence: number;
  provenance: "system" | "ai" | "human";
}
