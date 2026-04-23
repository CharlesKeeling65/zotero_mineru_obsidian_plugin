import { DEFAULT_PANEL_TABS } from "../ui/panel.js";
import { PLUGIN_MANIFEST, type PluginManifest } from "./manifest.js";

export interface BootstrappedPlugin {
  manifest: PluginManifest;
  tabs: string[];
}

export function bootstrapPlugin(): BootstrappedPlugin {
  return {
    manifest: PLUGIN_MANIFEST,
    tabs: DEFAULT_PANEL_TABS.map((tab) => tab.id)
  };
}
