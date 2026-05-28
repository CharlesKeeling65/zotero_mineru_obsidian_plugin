/**
 * Zotero Reader 工具栏按钮注册和管理。
 *
 * 中文：这个模块负责在 Zotero Reader 工具栏中添加 MinerU 解析按钮，
 * 让用户可以直接从 PDF 阅读器触发解析工作流。
 *
 * English: This module handles registering MinerU parse button in Zotero Reader toolbar,
 * allowing users to trigger parsing workflow directly from the PDF reader.
 */

import type { ParseSelectedPdfWithMineruInput } from "./mineru-workflow.js";
import type { MineruProvider } from "../mineru/client.js";
import type { TranslationProvider } from "../translate/provider.js";
import type { RagIntegration } from "../rag/rag-integration.js";

/**
 * Reader 工具栏按钮配置。
 *
 * 中文：定义按钮的外观和行为。
 * English: Define button appearance and behavior.
 */
export interface ReaderToolbarButtonConfig {
  /** 中文：按钮 ID，用于唯一标识；English: button ID for unique identification. */
  id: string;
  /** 中文：按钮标签（文字部分）；English: button label (text part). */
  label: string;
  /** 中文：按钮图标（SVG 或图标类名）；English: button icon (SVG or icon class name). */
  icon: string;
  /** 中文：按钮工具提示；English: button tooltip. */
  tooltip: string;
}

/**
 * 默认的 MinerU 解析按钮配置。
 *
 * 中文：使用 MinerU 图标和直观的文字标签。
 * English: Use MinerU icon and intuitive text label.
 */
export const MINERU_PARSE_BUTTON: ReaderToolbarButtonConfig = {
  id: "mineru-parse-button",
  label: "MinerU 解析",
  icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 2h6v1H5V7zm0 2h4v1H5V9z"/>
  </svg>`,
  tooltip: "使用 MinerU 解析当前 PDF 文档"
};

/**
 * Reader 工具栏按钮点击回调函数类型。
 *
 * 中文：当用户点击按钮时调用的函数。
 * English: Function called when user clicks the button.
 */
export type ReaderToolbarButtonClickCallback = (
  pdfPath: string,
  zoteroItemKey: string,
  title: string
) => Promise<void>;

/**
 * 注册 Reader 工具栏按钮。
 *
 * 中文：在 Zotero Reader 工具栏中注册一个按钮。
 * 注意：这个函数需要在 Zotero 环境中运行，使用 Zotero.Reader API。
 *
 * English: Register a button in Zotero Reader toolbar.
 * Note: This function needs to run in Zotero environment using Zotero.Reader API.
 *
 * @param config 按钮配置 / Button configuration
 * @param onClick 点击回调 / Click callback
 */
export function registerReaderToolbarButton(
  config: ReaderToolbarButtonConfig,
  onClick: ReaderToolbarButtonClickCallback
): void {
  // 中文：检查是否在 Zotero 环境中
  // English: Check if running in Zotero environment
  if (typeof Zotero === "undefined" || !Zotero.Reader) {
    console.warn("Zotero.Reader API not available. Button registration skipped.");
    return;
  }

  // 中文：注册工具栏按钮
  // English: Register toolbar button
  Zotero.Reader.registerToolbarButton({
    id: config.id,
    label: config.label,
    icon: config.icon,
    tooltip: config.tooltip,
    onClick: async (reader: any) => {
      try {
        // 中文：获取当前阅读的 PDF 信息
        // English: Get current PDF information
        const pdfPath = reader._location?.path;
        if (!pdfPath) {
          console.error("无法获取 PDF 路径");
          return;
        }

        // 中文：获取关联的 Zotero 条目
        // English: Get associated Zotero item
        const item = reader._item;
        if (!item) {
          console.error("无法获取 Zotero 条目");
          return;
        }

        const zoteroItemKey = item.key;
        const title = item.title || "Untitled";

        // 中文：调用点击回调
        // English: Call click callback
        await onClick(pdfPath, zoteroItemKey, title);
      } catch (error) {
        console.error("Reader 工具栏按钮点击处理失败:", error);
      }
    }
  });
}

/**
 * 创建 MinerU 解析工作流输入。
 *
 * 中文：从 Reader 工具栏按钮点击事件中创建解析工作流输入。
 * English: Create parse workflow input from Reader toolbar button click event.
 *
 * @param pdfPath PDF 文件路径 / PDF file path
 * @param zoteroItemKey Zotero 条目键 / Zotero item key
 * @param title 文档标题 / Document title
 * @param provider MinerU 提供者 / MinerU provider
 * @param translationProvider 翻译提供者（可选）/ Translation provider (optional)
 * @param ragIntegration RAG 集成（可选）/ RAG integration (optional)
 * @returns 解析工作流输入 / Parse workflow input
 */
export function createParseInputFromReader(
  pdfPath: string,
  zoteroItemKey: string,
  title: string,
  provider: MineruProvider,
  translationProvider?: TranslationProvider,
  ragIntegration?: RagIntegration
): ParseSelectedPdfWithMineruInput {
  // 中文：创建一个模拟的 Zotero 选中项
  // English: Create a mock Zotero selected item
  const selectedItem = {
    key: zoteroItemKey,
    kind: "attachment" as const,
    contentType: "application/pdf",
    path: pdfPath
  };

  return {
    selectedItem,
    provider,
    title,
    translationProvider,
    ragIntegration
  };
}

/**
 * 初始化 Reader 工具栏。
 *
 * 中文：初始化 Zotero Reader 工具栏，注册所有按钮。
 * English: Initialize Zotero Reader toolbar, register all buttons.
 *
 * @param onParseClick 解析按钮点击回调 / Parse button click callback
 */
export function initializeReaderToolbar(
  onParseClick: ReaderToolbarButtonClickCallback
): void {
  // 中文：注册 MinerU 解析按钮
  // English: Register MinerU parse button
  registerReaderToolbarButton(MINERU_PARSE_BUTTON, onParseClick);

  console.log("Reader 工具栏初始化完成");
}