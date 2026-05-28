/**
 * Structured Literature Workspace - Zotero 8/9 Plugin Bootstrap
 *
 * This file manages the plugin lifecycle and loads the main TypeScript-compiled code.
 * Compatible with Zotero 8 and Zotero 9.
 */

var chromeHandle;
var slwRootURI;

function install(data, reason) {
  Zotero.log("SLW: install");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  Zotero.log("SLW: startup");
  slwRootURI = rootURI;

  // Register chrome content for the addon
  try {
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "slw", rootURI + "content/"],
    ]);
    Zotero.log("SLW: Chrome content registered");
  } catch (e) {
    Zotero.log("SLW: Failed to register chrome: " + e.message);
  }

  // Load the main plugin script
  try {
    Services.scriptloader.loadSubScript(
      `${rootURI}content/scripts/slw.js`,
      { rootURI }
    );
    Zotero.log("SLW: Main script loaded");
  } catch (e) {
    Zotero.log("SLW: Failed to load main script: " + e.message);
  }

  // Initialize the plugin hooks
  try {
    if (Zotero.__slw__ && Zotero.__slw__.hooks) {
      await Zotero.__slw__.hooks.onStartup();
      Zotero.log("SLW: Startup hooks executed");
    } else {
      Zotero.log("SLW: Plugin instance not found, registering UI directly");
      registerUIFallback();
    }
  } catch (e) {
    Zotero.log("SLW: Failed to execute startup hooks: " + e.message);
  }
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.log("SLW: onMainWindowLoad");

  try {
    if (Zotero.__slw__ && Zotero.__slw__.hooks) {
      await Zotero.__slw__.hooks.onMainWindowLoad(window);
    } else {
      registerWindowUI(window);
    }
  } catch (e) {
    Zotero.log("SLW: onMainWindowLoad error: " + e.message);
  }
}

async function onMainWindowUnload({ window }, reason) {
  Zotero.log("SLW: onMainWindowUnload");

  try {
    if (Zotero.__slw__ && Zotero.__slw__.hooks) {
      await Zotero.__slw__.hooks.onMainWindowUnload(window);
    }
  } catch (e) {
    Zotero.log("SLW: onMainWindowUnload error: " + e.message);
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.log("SLW: shutdown");

  try {
    if (Zotero.__slw__ && Zotero.__slw__.hooks) {
      await Zotero.__slw__.hooks.onShutdown();
    }
  } catch (e) {
    Zotero.log("SLW: shutdown error: " + e.message);
  }

  // Clean up UI elements from all windows
  try {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      // Remove menu item
      let menuitem = win.document.getElementById('slw-parse-menu-item');
      if (menuitem) menuitem.remove();
      
      // Remove reader button
      let button = win.document.getElementById('slw-parse-button');
      if (button) button.remove();
    }
  } catch (e) {
    Zotero.log("SLW: Failed to clean up UI: " + e.message);
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {
  Zotero.log("SLW: uninstall");
}

// ============================================================
// Fallback UI Registration (if main script fails to load)
// ============================================================

function registerUIFallback() {
  Zotero.log("SLW: Using fallback UI registration");

  try {
    // Register preference pane
    Zotero.PreferencePanes.register({
      pluginID: "structured-literature-workspace@yourdomain.com",
      src: slwRootURI + "content/preferences.xhtml",
      label: "Structured Literature Workspace",
      image: `chrome://slw/content/icons/icon-48.png`
    });
    Zotero.log("SLW: Preference pane registered (fallback)");
  } catch (e) {
    Zotero.log("SLW: Failed to register preference pane: " + e.message);
  }

  try {
    // Register item pane section
    Zotero.ItemPaneManager.registerSection({
      paneID: "slw-structured-content",
      pluginID: "structured-literature-workspace@yourdomain.com",
      header: {
        label: "Structured Content",
        icon: `chrome://slw/content/icons/icon-16.png`
      },
      body: {
        onRender: (doc, container) => {
          container.innerHTML = `
            <div style="padding: 10px;">
              <p>Structured content will appear here after parsing a PDF.</p>
              <p><em>Install the full plugin to enable MinerU parsing.</em></p>
            </div>
          `;
        }
      }
    });
    Zotero.log("SLW: Item pane section registered (fallback)");
  } catch (e) {
    Zotero.log("SLW: Failed to register item pane section: " + e.message);
  }
}

function registerWindowUI(win) {
  Zotero.log("SLW: Registering window UI");

  try {
    const doc = win.document;

    // Add menu item to Tools menu
    const toolsMenu = doc.querySelector('#menu_toolsPopup');
    if (toolsMenu) {
      const menuitem = doc.createElement('menuitem');
      menuitem.id = 'slw-parse-menu-item';
      menuitem.setAttribute('label', 'Parse with MinerU');
      menuitem.addEventListener('command', () => {
        showNotification(win, "SLW", "Please install the full plugin to use MinerU parsing.");
      });
      toolsMenu.appendChild(menuitem);
      Zotero.log("SLW: Tools menu item added");
    }

    // Register reader event listener
    Zotero.Reader.registerEventListener("DOMContentLoaded", (event) => {
      const { reader, doc } = event;
      injectReaderButton(reader, doc);
    });
    Zotero.log("SLW: Reader listener registered");

  } catch (e) {
    Zotero.log("SLW: Failed to register window UI: " + e.message);
  }
}

function injectReaderButton(reader, doc) {
  try {
    const toolbar = doc.querySelector('#toolbar') ||
                    doc.querySelector('.toolbar') ||
                    doc.querySelector('[class*="toolbar"]');

    if (!toolbar) return;

    const button = doc.createElement('button');
    button.id = 'slw-parse-button';
    button.textContent = 'SLW';
    button.title = 'Parse with MinerU';
    button.style.cssText = `
      background: #4a90d9;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      margin: 0 4px;
      cursor: pointer;
      font-size: 12px;
    `;

    button.addEventListener('click', () => {
      showNotification(doc.defaultView, "SLW", "Please install the full plugin to use MinerU parsing.");
    });

    toolbar.appendChild(button);
    Zotero.log("SLW: Reader button injected");
  } catch (e) {
    Zotero.log("SLW: Failed to inject reader button: " + e.message);
  }
}

function showNotification(win, title, body) {
  try {
    const progressWin = new Zotero.ProgressWindow();
    progressWin.changeHeadline(title);
    progressWin.show();
    progressWin.addDescription(body);
    progressWin.startCloseTimer(4000);
  } catch (e) {
    Zotero.log("SLW: " + title + " - " + body);
  }
}