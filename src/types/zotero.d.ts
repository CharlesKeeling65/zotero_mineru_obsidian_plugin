/**
 * Zotero global type declarations for Zotero 8/9.
 *
 * These declarations are only used for compile-time type checking;
 * the actual Zotero object is injected at runtime by the Zotero application.
 */

// DOM types that are available in Zotero's XUL environment
declare const Window: typeof globalThis extends { Window: infer W } ? W : never;
declare const Document: typeof globalThis extends { Document: infer D } ? D : never;
declare const HTMLElement: typeof globalThis extends { HTMLElement: infer H } ? H : never;

// Global variables provided by bootstrap.js
declare const rootURI: string;
declare const ZoteroPane: any;

// Zotero main global object
declare const Zotero: {
  [key: string]: any;

  /** Database operations */
  Items: {
    getByLibraryAndKeyAsync(libraryId: number, key: string): Promise<any>;
    getAsync(id: number): Promise<any>;
    erase(ids: number | number[]): Promise<void>;
  };

  /** Item operations */
  Item: new (itemType: string) => any;

  /** Attachment operations */
  Attachments: {
    LINK_MODE_IMPORTED_FILE: number;
    getStoredAttachments(itemKey: string): Promise<any[]>;
    importFromURL(url: string, options: any): Promise<any>;
    importFromFile(file: any, options: any): Promise<any>;
    putContentsAsync(file: any, content: string | Uint8Array, options?: any): Promise<void>;
  };

  /** Library information */
  Libraries: {
    userLibraryID: number;
  };

  /** Reader API (Zotero 8/9) */
  Reader: {
    registerEventListener(eventType: string, callback: (event: any) => void): void;
    registerToolbarButton(config: {
      id: string;
      label: string;
      icon: string;
      tooltip: string;
      onClick: (reader: any) => Promise<void>;
    }): void;
  };

  /** Notification system */
  Notifier: {
    registerObserver(observer: any, types: string[], id?: string): void;
    unregisterObserver(id: string): void;
    notify(options: { type: string; title: string; message: string; timeout?: number }): void;
  };

  /** Preference Panes API (Zotero 8/9) */
  PreferencePanes: {
    register(pane: {
      pluginID: string;
      src: string;
      label: string;
      image?: string;
    }): void;
  };

  /** Preferences API */
  Prefs: {
    get(key: string): any;
    set(key: string, value: any): void;
  };

  /** Item Pane Manager API (Zotero 8/9) */
  ItemPaneManager: {
    registerSection(options: {
      paneID: string;
      pluginID: string;
      header: {
        l10nID?: string;
        label?: string;
        icon?: string;
      };
      body: {
        onRender: (doc: Document, container: HTMLElement) => void;
      };
    }): void;
    unregisterSection(paneID: string): void;
  };

  /** Item Tree Manager API (Zotero 8/9) */
  ItemTreeManager: {
    registerColumn(column: {
      dataKey: string;
      label: string;
      pluginID: string;
      dataProvider: (item: any, dataKey: string) => string;
    }): void;
    unregisterColumn(dataKey: string): void;
  };

  /** Window management */
  getMainWindows(): Window[];

  /** Localization */
  getString(key: string): string;

  /** Logging */
  debug(message: string): void;
  log(message: string): void;

  /** Initialization */
  initializationPromise: Promise<void>;

  /** Platform detection */
  isWin: boolean;
  isMac: boolean;
  isLinux: boolean;
};
