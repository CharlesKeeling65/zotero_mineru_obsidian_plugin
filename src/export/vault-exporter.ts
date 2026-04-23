import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { NormalizedDocument } from "../normalize/normalizer.js";

export interface VaultExportRequest {
  rootDir: string;
  folderName: string;
  normalized: NormalizedDocument;
}

export async function exportToVault(
  request: VaultExportRequest
): Promise<void> {
  const baseDir = join(request.rootDir, "Papers", request.folderName);
  await mkdir(join(baseDir, "blocks"), { recursive: true });
  await mkdir(join(baseDir, "assets"), { recursive: true });
  await mkdir(join(baseDir, "ai"), { recursive: true });

  await writeFile(
    join(baseDir, "document.json"),
    JSON.stringify(request.normalized, null, 2),
    "utf8"
  );
  await writeFile(
    join(baseDir, "full.md"),
    request.normalized.document.fullMarkdown,
    "utf8"
  );
}
