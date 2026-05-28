/**
 * Main entry point for the Structured Literature Workspace plugin.
 *
 * This file is loaded by bootstrap.js and initializes the plugin,
 * registering it with the Zotero global object.
 */
import { BasicTool } from "zotero-plugin-toolkit";
import { hooks } from "./hooks.js";
// Plugin configuration (matches package.json)
const ADDON_CONFIG = {
    addonID: "structured-literature-workspace@yourdomain.com",
    addonName: "Structured Literature Workspace",
    addonInstance: "__slw__",
    addonRef: "slw",
};
const basicTool = new BasicTool();
// Prevent multiple initialization
if (!basicTool.getGlobal("Zotero")[ADDON_CONFIG.addonInstance]) {
    // Create plugin instance
    const addon = {
        data: {
            alive: true,
            config: ADDON_CONFIG,
            ztoolkit: basicTool,
        },
        hooks,
    };
    // Register on Zotero global object
    Zotero[ADDON_CONFIG.addonInstance] = addon;
}
