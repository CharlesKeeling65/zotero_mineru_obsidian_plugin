export { bootstrapPlugin } from "./plugin/bootstrap.js";
export { PLUGIN_MANIFEST, type PluginManifest } from "./plugin/manifest.js";
export { MineruAgentProvider } from "./mineru/provider-agent.js";
export { parseSelectedPdfWithMineru } from "./zotero/mineru-workflow.js";
export { ensureMarkdownTextBlocks, markdownToTextBlocks } from "./parse/markdown-preprocessor.js";
export {
  translateDocumentTextBlocks,
  type TranslatedTextBlock
} from "./translate/contextual-translator.js";
export type {
  ParagraphTranslationRequest,
  TranslationProvider
} from "./translate/provider.js";
export {
  GRAY_TRANSLATION_ANNOTATION_COLOR,
  RuntimeZoteroAnnotationWriter,
  buildTranslationAnnotationPayloads,
  type TranslationAnnotationWriter,
  type ZoteroTranslationAnnotationPayload
} from "./zotero/annotations.js";
export {
  findTextLocationForParagraph,
  resolveTextLocationsForTranslations,
  type ZoteroReaderPageText,
  type ZoteroReaderTextLocationProvider,
  type ZoteroReaderTextRun,
  type ZoteroTextLocation
} from "./zotero/text-location.js";
