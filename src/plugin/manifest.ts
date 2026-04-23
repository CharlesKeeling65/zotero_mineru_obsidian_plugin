export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  zoteroCompatibility: {
    minimum: number;
    tested: number[];
  };
}

export const PLUGIN_MANIFEST: PluginManifest = {
  id: "structured-literature-workspace",
  name: "Structured Literature Workspace",
  version: "0.1.0",
  zoteroCompatibility: {
    minimum: 8,
    tested: [8, 9]
  }
};
