import type { NormalizedDocument } from "../normalize/normalizer.js";
import { normalizeMineruDocument } from "../normalize/normalizer.js";
import type { MineruProvider, ParsePdfInput } from "../mineru/client.js";
import type { ParseCache } from "./parse-cache.js";
import { ensureMarkdownTextBlocks } from "./markdown-preprocessor.js";

export interface ParseServiceDependencies {
  provider: MineruProvider;
  cache: ParseCache;
}

export class ParseService {
  public constructor(private readonly dependencies: ParseServiceDependencies) {}

  public async parse(input: ParsePdfInput): Promise<NormalizedDocument> {
    const response = await this.dependencies.provider.parsePdf(input);

    for (const rawFile of response.rawFiles) {
      await this.dependencies.cache.writeRawFile(rawFile.name, rawFile.content);
    }

    return normalizeMineruDocument(
      ensureMarkdownTextBlocks(response.document),
      this.dependencies.provider.backendName
    );
  }
}
