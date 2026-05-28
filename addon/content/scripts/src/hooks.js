/**
 * Plugin lifecycle hooks for Structured Literature Workspace.
 *
 * This file manages the plugin's lifecycle events and UI registration
 * following the official Zotero 8/9 plugin development patterns.
 */
import { parseSelectedPdfWithMineru } from "./zotero/mineru-workflow.js";
import { MineruAgentProvider } from "./mineru/provider-agent.js";
import { MineruStandardProvider } from "./mineru/provider-standard.js";
import { defaultLogger } from "./utils/logger.js";
import { AttachmentType } from "./zotero/attachment-manager.js";
// Plugin configuration
const ADDON_CONFIG = {
    addonID: "structured-literature-workspace@yourdomain.com",
    addonInstance: "__slw__",
    addonRef: "slw",
};
let provider = null;
export const hooks = {
    /**
     * Called when the plugin starts up.
     * Registers preference pane and initializes core functionality.
     */
    async onStartup() {
        defaultLogger.info("Structured Literature Workspace starting up");
        // Register preference pane
        this.registerPrefs();
        // Initialize MinerU provider
        this.initializeProvider();
        // Register reader event listener
        this.registerReaderEventListener();
    },
    /**
     * Called when a main window loads.
     * Registers window-specific UI elements.
     */
    async onMainWindowLoad(win) {
        defaultLogger.info("Main window loaded, registering UI elements");
        // Register stylesheet
        this.registerStyleSheet(win);
        // Register menu items
        this.registerMenuItems(win);
        // Register item pane section
        this.registerItemPaneSection();
    },
    /**
     * Called when a main window unloads.
     */
    async onMainWindowUnload(win) {
        defaultLogger.info("Main window unloaded");
    },
    /**
     * Called when the plugin shuts down.
     * Cleans up all registered elements.
     */
    async onShutdown() {
        defaultLogger.info("Structured Literature Workspace shutting down");
        provider = null;
        // Unregister all UI elements
        const ztoolkit = Zotero[ADDON_CONFIG.addonInstance]?.data?.ztoolkit;
        if (ztoolkit) {
            ztoolkit.unregisterAll();
        }
        // Remove plugin from Zotero global
        delete Zotero[ADDON_CONFIG.addonInstance];
    },
    /**
     * Register the preference pane.
     */
    registerPrefs() {
        const prefPane = {
            pluginID: ADDON_CONFIG.addonID,
            src: rootURI + "content/preferences.xhtml",
            label: "Structured Literature Workspace",
            image: `chrome://slw/content/icons/icon-48.png`,
        };
        Zotero.PreferencePanes.register(prefPane);
        defaultLogger.info("Preference pane registered");
    },
    /**
     * Load preference pane content.
     */
    onPrefsLoad(document) {
        defaultLogger.info("Preferences loaded");
        // Additional preference initialization logic can go here
    },
    /**
     * Initialize MinerU provider based on preferences.
     */
    initializeProvider() {
        const prefs = Zotero.Prefs;
        const backend = prefs.get("extensions.zotero.slw.mineruBackend") || "agent";
        const apiKey = prefs.get("extensions.zotero.slw.apiKey") || "";
        if (backend === "standard") {
            const apiUrl = prefs.get("extensions.zotero.slw.standardApiUrl") || "https://mineru.net/api/v4";
            provider = new MineruStandardProvider({ baseUrl: apiUrl, apiKey });
            defaultLogger.info("Using MinerU Standard API", { apiUrl });
        }
        else {
            const apiUrl = prefs.get("extensions.zotero.slw.agentApiUrl") || "https://mineru.net/api/v1/agent";
            provider = new MineruAgentProvider({ baseUrl: apiUrl, apiKey });
            defaultLogger.info("Using MinerU Agent API", { apiUrl });
        }
    },
    /**
     * Register reader event listener for PDF toolbar.
     * Uses the official Zotero.Reader.registerEventListener API.
     */
    registerReaderEventListener() {
        Zotero.Reader.registerEventListener("DOMContentLoaded", (event) => {
            const { reader, doc } = event;
            this.injectReaderToolbarButton(reader, doc);
        });
        defaultLogger.info("Reader event listener registered");
    },
    /**
     * Inject toolbar button into PDF reader.
     */
    injectReaderToolbarButton(reader, doc) {
        // Find the toolbar area
        const toolbar = doc.querySelector("#toolbar") || doc.querySelector(".toolbar");
        if (!toolbar) {
            defaultLogger.warn("Could not find reader toolbar");
            return;
        }
        // Create button element
        const button = doc.createElement("button");
        button.id = "slw-parse-button";
        button.className = "toolbarButton";
        button.title = "Parse with MinerU";
        button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 2h6v1H5V7zm0 2h4v1H5V9z"/>
      </svg>
    `;
        button.addEventListener("click", async () => {
            await this.handleParseButtonClick(reader);
        });
        toolbar.appendChild(button);
        defaultLogger.info("Reader toolbar button injected");
    },
    /**
     * Handle parse button click in reader.
     */
    async handleParseButtonClick(reader) {
        if (!provider) {
            defaultLogger.error("MinerU provider not initialized");
            return;
        }
        const pdfPath = reader._location?.path;
        const item = reader._item;
        if (!pdfPath || !item) {
            defaultLogger.error("Could not get PDF path or item");
            return;
        }
        const title = item.title || "Untitled";
        try {
            defaultLogger.info("Starting PDF parse from reader", { pdfPath, title });
            const result = await parseSelectedPdfWithMineru({
                selectedItem: {
                    key: item.key,
                    kind: "attachment",
                    contentType: "application/pdf",
                    path: pdfPath,
                },
                provider,
                title,
                attachmentManagerConfig: {
                    autoAddAttachments: true,
                    overwriteExisting: false,
                    attachmentTypes: [AttachmentType.MARKDOWN, AttachmentType.JSON, AttachmentType.IMAGE],
                },
            });
            defaultLogger.info("PDF parse completed", {
                docId: result.normalized.document.documentId,
                blockCount: result.normalized.blocks.length,
            });
            // Show success notification
            Zotero.Notifier.notify({
                type: "message",
                title: "Parse Complete",
                message: `Successfully parsed: ${title}`,
                timeout: 5000,
            });
        }
        catch (error) {
            defaultLogger.error("PDF parse failed", { error: error.message });
            Zotero.Notifier.notify({
                type: "message",
                title: "Parse Failed",
                message: `Error parsing ${title}: ${error.message}`,
                timeout: 8000,
            });
        }
    },
    /**
     * Register stylesheet for the plugin.
     */
    registerStyleSheet(win) {
        const doc = win.document;
        const style = doc.createElement("style");
        style.textContent = `
      #slw-parse-button {
        background: none;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        color: inherit;
        font-size: 12px;
      }
      #slw-parse-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
        border-color: rgba(0, 0, 0, 0.2);
      }
      #slw-parse-button:active {
        background-color: rgba(0, 0, 0, 0.2);
      }
      .slw-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        font-weight: bold;
      }
      .slw-section-content {
        padding: 8px;
      }
      .slw-block-card {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .slw-block-card:hover {
        border-color: #aaa;
      }
    `;
        doc.head.appendChild(style);
    },
    /**
     * Register menu items in the main window.
     */
    registerMenuItems(win) {
        const doc = win.document;
        // Add menu item to Tools menu
        const toolsMenu = doc.querySelector("#menu_toolsPopup") ||
            doc.querySelector('[id*="tools"]');
        if (toolsMenu) {
            const menuItem = doc.createElement("menuitem");
            menuItem.id = "slw-parse-menu-item";
            menuItem.setAttribute("label", "Parse with MinerU");
            menuItem.addEventListener("command", () => {
                this.handleMenuParseClick();
            });
            toolsMenu.appendChild(menuItem);
            defaultLogger.info("Tools menu item registered");
        }
    },
    /**
     * Handle menu parse click.
     */
    async handleMenuParseClick() {
        const selectedItems = ZoteroPane.getSelectedItems();
        if (selectedItems.length === 0) {
            Zotero.Notifier.notify({
                type: "message",
                title: "No Selection",
                message: "Please select a PDF attachment to parse",
                timeout: 3000,
            });
            return;
        }
        // Find PDF attachment
        for (const item of selectedItems) {
            if (item.isAttachment?.()) {
                const contentType = item.attachmentContentType;
                if (contentType === "application/pdf") {
                    const path = await item.getFilePathAsync();
                    if (path) {
                        // Trigger parse
                        defaultLogger.info("Parse requested for", { path });
                    }
                }
            }
        }
    },
    /**
     * Register custom item pane section.
     * Uses the official Zotero.ItemPaneManager.registerSection API.
     */
    registerItemPaneSection() {
        try {
            Zotero.ItemPaneManager.registerSection({
                paneID: "slw-structured-content",
                pluginID: ADDON_CONFIG.addonID,
                header: {
                    l10nID: "slw-section-header",
                    icon: `chrome://slw/content/icons/icon-16.png`,
                },
                body: {
                    onRender: (doc, container) => {
                        this.renderItemPaneSection(doc, container);
                    },
                },
            });
            defaultLogger.info("Item pane section registered");
        }
        catch (error) {
            defaultLogger.warn("Could not register item pane section", { error: error.message });
        }
    },
    /**
     * Render content for the item pane section.
     */
    renderItemPaneSection(doc, container) {
        container.innerHTML = `
      <div class="slw-section-content">
        <p>Structured content will appear here after parsing.</p>
      </div>
    `;
    },
};
