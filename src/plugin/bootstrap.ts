import { DEFAULT_PANEL_TABS } from "../ui/panel.js";
import { PLUGIN_MANIFEST, type PluginManifest } from "./manifest.js";
import { initializeReaderToolbar } from "../zotero/reader-toolbar.js";
import { parseSelectedPdfWithMineru } from "../zotero/mineru-workflow.js";
import { MineruAgentProvider } from "../mineru/provider-agent.js";
import { MineruStandardProvider } from "../mineru/provider-standard.js";
import type { MineruProvider } from "../mineru/client.js";
import type { TranslationProvider } from "../translate/provider.js";
import type { RagIntegration } from "../rag/rag-integration.js";
import { defaultLogger } from "../utils/logger.js";
import { AttachmentType } from "../zotero/attachment-manager.js";

/**
 * Zotero 插件引导模块。
 *
 * 中文：实现 Zotero 8/9 WebExtension 插件的完整生命周期。
 * Zotero 要求插件导出 startup、shutdown、install、uninstall 四个函数。
 *
 * English: Implements the full lifecycle for Zotero 8/9 WebExtension plugin.
 * Zotero requires plugins to export startup, shutdown, install, uninstall functions.
 */

export interface BootstrappedPlugin {
  manifest: PluginManifest;
  tabs: string[];
  initializeReaderToolbar: (
    provider: MineruProvider,
    translationProvider?: TranslationProvider,
    ragIntegration?: RagIntegration
  ) => void;
}

/**
 * 插件实例管理器。
 *
 * 中文：管理插件状态、provider 实例和配置。
 * English: Manages plugin state, provider instances, and configuration.
 */
class PluginManager {
  private static instance: PluginManager;
  private provider: MineruProvider | null = null;
  private translationProvider: TranslationProvider | null = null;
  private ragIntegration: RagIntegration | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * 初始化插件。
   *
   * 中文：创建 MinerU provider 实例，初始化 Reader 工具栏。
   * English: Create MinerU provider instance, initialize Reader toolbar.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      defaultLogger.warn("插件已经初始化，跳过重复初始化");
      return;
    }

    defaultLogger.info("开始初始化 Structured Literature Workspace 插件");

    try {
      // 中文：从 Zotero 偏好设置中读取配置
      // English: Read configuration from Zotero preferences
      const config = this.loadConfiguration();
      
      // 中文：创建 MinerU provider 实例（默认使用 Agent API）
      // English: Create MinerU provider instance (default to Agent API)
      this.provider = this.createMineruProvider(config);
      
      // 中文：初始化 Reader 工具栏
      // English: Initialize Reader toolbar
      this.initializeReaderToolbar();
      
      this.isInitialized = true;
      defaultLogger.info("插件初始化完成", { 
        providerBackend: this.provider.backendName,
        hasTranslation: !!this.translationProvider,
        hasRag: !!this.ragIntegration
      });
    } catch (error) {
      defaultLogger.error("插件初始化失败", { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 加载配置。
   *
   * 中文：从 Zotero 偏好设置中读取插件配置。
   * English: Load plugin configuration from Zotero preferences.
   */
  private loadConfiguration(): any {
    // 中文：这里从 Zotero 偏好设置中读取配置
    // English: Read configuration from Zotero preferences
    // 实际实现需要使用 Zotero.Prefs API
    // Actual implementation needs to use Zotero.Prefs API
    
    defaultLogger.debug("加载插件配置");
    
    // 默认配置
    return {
      mineruBackend: "agent", // "agent" 或 "standard"
      agentApiUrl: "https://mineru.net/api/v1/agent",
      standardApiUrl: "https://mineru.net/api/v4",
      apiKey: "", // 精准解析 API 需要
      enableTranslation: false,
      enableRag: false,
      enableAttachmentManager: true
    };
  }

  /**
   * 创建 MinerU provider。
   *
   * 中文：根据配置创建对应的 MinerU provider 实例。
   * English: Create MinerU provider instance based on configuration.
   */
  private createMineruProvider(config: any): MineruProvider {
    if (config.mineruBackend === "standard") {
      defaultLogger.info("使用 MinerU Standard API", { apiUrl: config.standardApiUrl });
      return new MineruStandardProvider({
        baseUrl: config.standardApiUrl,
        apiKey: config.apiKey
      });
    } else {
      defaultLogger.info("使用 MinerU Agent API", { apiUrl: config.agentApiUrl });
      return new MineruAgentProvider({
        baseUrl: config.agentApiUrl,
        apiKey: config.apiKey
      });
    }
  }

  /**
   * 初始化 Reader 工具栏。
   *
   * 中文：注册 MinerU 解析按钮到 Zotero Reader 工具栏。
   * English: Register MinerU parse button to Zotero Reader toolbar.
   */
  private initializeReaderToolbar(): void {
    if (!this.provider) {
      defaultLogger.error("无法初始化 Reader 工具栏：provider 未初始化");
      return;
    }

    defaultLogger.info("初始化 Reader 工具栏");
    
    initializeReaderToolbar(async (pdfPath, zoteroItemKey, title) => {
      try {
        defaultLogger.info("Reader 工具栏按钮点击", { pdfPath, zoteroItemKey, title });
        
        // 中文：调用完整的解析工作流
        // English: Call the complete parse workflow
        const result = await parseSelectedPdfWithMineru({
          selectedItem: {
            key: zoteroItemKey,
            kind: "attachment",
            contentType: "application/pdf",
            path: pdfPath
          },
          provider: this.provider!,
          title,
          translationProvider: this.translationProvider || undefined,
          ragIntegration: this.ragIntegration || undefined,
          attachmentManagerConfig: {
            autoAddAttachments: true,
            overwriteExisting: false,
            attachmentTypes: [AttachmentType.MARKDOWN, AttachmentType.JSON, AttachmentType.IMAGE]
          }
        });

        defaultLogger.info("PDF 解析完成", { 
          docId: result.normalized.document.documentId,
          blockCount: result.normalized.blocks.length,
          outputDir: result.outputDir,
          attachmentsAdded: result.attachments?.addedCount || 0
        });

        // 中文：显示成功通知
        // English: Show success notification
        this.showNotification("解析完成", `已成功解析: ${title}`);
        
      } catch (error) {
        defaultLogger.error("PDF 解析失败", { error: (error as Error).message, pdfPath });
        this.showNotification("解析失败", `解析 ${title} 时出错: ${(error as Error).message}`);
      }
    });
  }

  /**
   * 显示通知。
   *
   * 中文：使用 Zotero 通知系统显示消息。
   * English: Show notification using Zotero notification system.
   */
  private showNotification(title: string, message: string): void {
    // 中文：使用 Zotero 通知系统
    // English: Use Zotero notification system
    if (typeof Zotero !== "undefined" && Zotero.Notifier) {
      Zotero.Notifier.notify({
        type: "message",
        title,
        message,
        timeout: 5000
      });
    } else {
      defaultLogger.info(`通知: ${title} - ${message}`);
    }
  }

  /**
   * 关闭插件。
   *
   * 中文：清理资源，保存状态。
   * English: Cleanup resources, save state.
   */
  async shutdown(): Promise<void> {
    defaultLogger.info("关闭 Structured Literature Workspace 插件");
    
    // 中文：清理资源
    // English: Cleanup resources
    this.provider = null;
    this.translationProvider = null;
    this.ragIntegration = null;
    this.isInitialized = false;
    
    defaultLogger.info("插件已关闭");
  }

  /**
   * 安装插件。
   *
   * 中文：首次安装时执行的操作。
   * English: Operations to perform on first installation.
   */
  async install(): Promise<void> {
    defaultLogger.info("安装 Structured Literature Workspace 插件");
    
    // 中文：设置默认配置
    // English: Set default configuration
    // 这里可以初始化默认偏好设置
    // Can initialize default preferences here
    
    defaultLogger.info("插件安装完成");
  }

  /**
   * 卸载插件。
   *
   * 中文：卸载时清理数据。
   * English: Cleanup data on uninstallation.
   */
  async uninstall(): Promise<void> {
    defaultLogger.info("卸载 Structured Literature Workspace 插件");
    
    // 中文：清理插件数据
    // English: Cleanup plugin data
    // 这里可以删除偏好设置、缓存等
    // Can delete preferences, cache, etc.
    
    defaultLogger.info("插件卸载完成");
  }
}

// 中文：导出插件生命周期函数
// English: Export plugin lifecycle functions

/**
 * 插件启动函数。
 *
 * 中文：Zotero 在插件加载时调用此函数。
 * English: Zotero calls this function when the plugin is loaded.
 */
export async function startup(): Promise<void> {
  defaultLogger.info("Structured Literature Workspace 插件启动");
  await PluginManager.getInstance().initialize();
}

/**
 * 插件关闭函数。
 *
 * 中文：Zotero 在插件卸载时调用此函数。
 * English: Zotero calls this function when the plugin is unloaded.
 */
export async function shutdown(): Promise<void> {
  await PluginManager.getInstance().shutdown();
}

/**
 * 插件安装函数。
 *
 * 中文：Zotero 在插件首次安装时调用此函数。
 * English: Zotero calls this function when the plugin is first installed.
 */
export async function install(): Promise<void> {
  await PluginManager.getInstance().install();
}

/**
 * 插件卸载函数。
 *
 * 中文：Zotero 在插件卸载时调用此函数。
 * English: Zotero calls this function when the plugin is uninstalled.
 */
export async function uninstall(): Promise<void> {
  await PluginManager.getInstance().uninstall();
}

// 中文：保留原有的 bootstrapPlugin 函数以保持向后兼容
// English: Keep the original bootstrapPlugin function for backward compatibility
export function bootstrapPlugin(): BootstrappedPlugin {
  return {
    manifest: PLUGIN_MANIFEST,
    tabs: DEFAULT_PANEL_TABS.map((tab) => tab.id),
    initializeReaderToolbar: (
      provider: MineruProvider,
      translationProvider?: TranslationProvider,
      ragIntegration?: RagIntegration
    ) => {
      // 中文：这个函数现在由 PluginManager 管理
      // English: This function is now managed by PluginManager
      defaultLogger.warn("bootstrapPlugin.initializeReaderToolbar 已弃用，请使用 startup() 函数");
    }
  };
}
