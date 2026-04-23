export interface PanelTab {
  id: "outline" | "cards" | "visuals" | "export";
  label: string;
}

export const DEFAULT_PANEL_TABS: PanelTab[] = [
  { id: "outline", label: "Outline" },
  { id: "cards", label: "Cards" },
  { id: "visuals", label: "Visuals" },
  { id: "export", label: "Export" }
];
