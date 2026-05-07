export interface ParagraphTranslationRequest {
  text: string;
  fullDocumentMarkdown: string;
  documentTitle: string;
  sectionPath: string[];
  previousParagraph: string | null;
  nextParagraph: string | null;
  order: number;
}

export interface TranslationProvider {
  translateParagraph(request: ParagraphTranslationRequest): Promise<string>;
}
