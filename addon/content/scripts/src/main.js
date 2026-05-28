export { bootstrapPlugin } from "./plugin/bootstrap.js";
export { PLUGIN_MANIFEST } from "./plugin/manifest.js";
export { MineruAgentProvider } from "./mineru/provider-agent.js";
export { parseSelectedPdfWithMineru } from "./zotero/mineru-workflow.js";
export { ensureMarkdownTextBlocks, markdownToTextBlocks } from "./parse/markdown-preprocessor.js";
export { translateDocumentTextBlocks } from "./translate/contextual-translator.js";
export { GRAY_TRANSLATION_ANNOTATION_COLOR, RuntimeZoteroAnnotationWriter, buildTranslationAnnotationPayloads } from "./zotero/annotations.js";
export { findTextLocationForParagraph, resolveTextLocationsForTranslations } from "./zotero/text-location.js";
// RAG integration exports
export { RagClient, createRagClientFromSettings } from "./rag/rag-client.js";
export { RagIntegration, createRagIntegration } from "./rag/rag-integration.js";
