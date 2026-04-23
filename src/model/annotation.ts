export interface AIAnnotation {
  annotationId: string;
  documentId: string;
  target: {
    type: "document" | "block";
    id: string;
  };
  kind:
    | "summary"
    | "importance_score"
    | "keywords"
    | "question"
    | "answer"
    | "method_role"
    | "claim"
    | "evidence"
    | "limitation"
    | "reproducibility_note";
  provider: string;
  model: string;
  content: string;
  createdAt: string;
}
