import type { MineruStandardConfig } from "./config.js";
import type { MineruProvider, ParsePdfInput, ParsePdfOutput } from "./client.js";

export class MineruStandardProvider implements MineruProvider {
  public readonly backendName = "standard";

  public constructor(private readonly config: MineruStandardConfig) {}

  public async parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput> {
    void this.config;

    return {
      document: {
        docId: input.docId,
        zoteroItemKey: input.zoteroItemKey,
        title: input.title,
        markdown: "",
        blocks: []
      },
      rawFiles: []
    };
  }
}
