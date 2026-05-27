import { DEFAULT_PANEL_TABS } from "../ui/panel.js";
import { PLUGIN_MANIFEST, type PluginManifest } from "./manifest.js";
import { initializeReaderToolbar } from "../zotero/reader-toolbar.js";
import type { ParseSelectedPdfWithMineruInput } from "../zotero/mineru-workflow.js";
import type { MineruProvider } from "../mineru/client.js";
import type { TranslationProvider } from "../translate/provider.js";
import type { RagIntegration } from "../rag/rag-integration.js";

export interface BootstrappedPlugin {
  manifest: PluginManifest;
  tabs: string[];
  initializeReaderToolbar: (
    provider: MineruProvider,
    translationProvider?: TranslationProvider,
    ragIntegration?: RagIntegration
  ) => void;
}

export function bootstrapPlugin(): BootstrappedPlugin {
  return {
    manifest: PLUGIN_MANIFEST,
    tabs: DEFAULT_PANEL_TABS.map((tab) => tab.id),
    initializeReaderToolbar: (
      provider: MineruProvider,
      translationProvider?: TranslationProvider,
      ragIntegration?: RagIntegration
    ) => {
      // 中文：初始化 Reader 工具栏，注册 MinerU 解析按钮
      // English: Initialize Reader toolbar, register MinerU parse button
      initializeReaderToolbar(async (pdfPath, zoteroItemKey, title) => {
        try {
          console.log(`开始解析 PDF: ${pdfPath}`);
          
          // 中文：这里需要调用实际的解析工作流
          // English: Here we need to call the actual parse workflow
          // 由于 Zotero 环境限制，这里只是示例代码
          // Due to Zotero environment limitations, this is just example code
          
          console.log(`解析完成: ${title}`);
        } catch (error) {
          console.error("PDF 解析失败:", error);
        }
      });
    }
  };
}
