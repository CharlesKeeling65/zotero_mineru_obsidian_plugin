import { describe, expect, it } from "vitest";

import { bootstrapPlugin } from "../../src/main.js";
import { PLUGIN_MANIFEST } from "../../src/plugin/manifest.js";

describe("bootstrapPlugin", () => {
  it("returns the canonical plugin manifest and panel tabs", () => {
    const bootstrapped = bootstrapPlugin();

    expect(bootstrapped.manifest).toBe(PLUGIN_MANIFEST);
    expect(bootstrapped.manifest.zoteroCompatibility.minimum).toBe(8);
    expect(bootstrapped.manifest.zoteroCompatibility.tested).toEqual([8, 9]);
    expect(bootstrapped.tabs).toEqual(["outline", "cards", "visuals", "export"]);
  });
});
