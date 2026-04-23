import type { MineruAgentConfig } from "./config.js";
import type { MineruProvider, ParsePdfInput, ParsePdfOutput } from "./client.js";

export class MineruAgentProvider implements MineruProvider {
  public readonly backendName = "agent";

  public constructor(private readonly config: MineruAgentConfig) {}

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
