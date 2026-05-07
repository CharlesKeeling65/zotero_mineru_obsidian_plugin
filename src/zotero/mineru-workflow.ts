import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import type { MineruProvider } from "../mineru/client.js";
import type { NormalizedDocument } from "../normalize/normalizer.js";
import { ParseService } from "../parse/parse-service.js";
import type { ParseCache } from "../parse/parse-cache.js";
import { resolvePdfSelection, type ResolvePdfSelectionInput } from "./selection.js";

export interface ParseSelectedPdfWithMineruInput extends ResolvePdfSelectionInput {
  provider: MineruProvider;
  title: string;
}

export interface ParseSelectedPdfWithMineruOutput {
  normalized: NormalizedDocument;
  outputDir: string;
}

class PdfSiblingParseCache implements ParseCache {
  public constructor(
    private readonly outputDir: string,
    private readonly pdfBaseName: string
  ) {}

  public async writeRawFile(name: string, content: string): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(join(this.outputDir, this.resolveOutputName(name)), content, "utf8");
  }

  private resolveOutputName(name: string): string {
    const extension = extname(name);
    if (!extension) {
      return this.pdfBaseName;
    }

    if (name.startsWith(`${this.pdfBaseName}.`)) {
      return name;
    }

    const suffix = basename(name, extension);
    return suffix === "full"
      ? `${this.pdfBaseName}${extension}`
      : `${this.pdfBaseName}.${suffix}${extension}`;
  }
}

export async function parseSelectedPdfWithMineru(
  input: ParseSelectedPdfWithMineruInput
): Promise<ParseSelectedPdfWithMineruOutput> {
  const selection = resolvePdfSelection({ selectedItem: input.selectedItem });
  const pdfPath = selection.attachment.path;
  const outputDir = dirname(pdfPath);
  const pdfBaseName = basename(pdfPath, extname(pdfPath));
  const zoteroItemKey = selection.parentItemKey ?? selection.attachment.key;
  const service = new ParseService({
    provider: input.provider,
    cache: new PdfSiblingParseCache(outputDir, pdfBaseName)
  });

  const normalized = await service.parse({
    docId: `zotero_${zoteroItemKey}`,
    zoteroItemKey,
    pdfPath,
    title: input.title
  });

  return { normalized, outputDir };
}
