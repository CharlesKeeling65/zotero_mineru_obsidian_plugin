/**
 * Input passed to a paragraph translation provider.
 *
 * 中文：这里不是直接把单段文字丢给翻译 API，而是把“全文、标题、上下文、顺序”
 * 一起传入。这样翻译服务可以根据论文主题和前后段落决定术语，更适合学术论文。
 *
 * English: do not translate a paragraph in isolation. Provide full document and
 * neighbor context so a provider can choose consistent academic terminology.
 *
 * Parameter notes:
 * - `text`: the paragraph to translate.
 * - `fullDocumentMarkdown`: whole MinerU Markdown for global context.
 * - `documentTitle`: paper title from Zotero/parse input.
 * - `sectionPath`: current section title path.
 * - `previousParagraph` / `nextParagraph`: local context window.
 * - `order`: explicit reading order.
 */
export interface ParagraphTranslationRequest {
  text: string;
  fullDocumentMarkdown: string;
  documentTitle: string;
  sectionPath: string[];
  previousParagraph: string | null;
  nextParagraph: string | null;
  order: number;
}

/**
 * Translation provider interface.
 *
 * 中文：这是“端口 / port”接口。核心 workflow 只依赖这个接口，不绑定某个 API。
 * 后续可实现 OpenAI、DeepL、本地模型或自定义服务。
 *
 * English: this is a port interface. The workflow depends on the contract, not
 * a concrete vendor. Implement OpenAI/DeepL/local services behind this shape.
 */
export interface TranslationProvider {
  translateParagraph(request: ParagraphTranslationRequest): Promise<string>;
}
