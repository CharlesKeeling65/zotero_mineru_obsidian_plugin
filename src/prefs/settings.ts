export interface PluginSettings {
  mineruBaseUrl: string;
  mineruApiKey: string;
  vaultRootDir: string;
  preferredBackend: "agent" | "standard";
}

export const DEFAULT_SETTINGS: PluginSettings = {
  mineruBaseUrl: "",
  mineruApiKey: "",
  vaultRootDir: "",
  preferredBackend: "agent"
};
