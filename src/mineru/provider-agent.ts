import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import type { MineruAgentConfig } from "./config.js";
import type { MineruProvider, ParsePdfInput, ParsePdfOutput } from "./client.js";
import { AppError } from "../utils/errors.js";

type MineruApiResponse<TData> = {
  code: number;
  msg?: string;
  data?: TData;
};

interface MineruCreateTaskData {
  task_id?: string;
  file_url?: string;
}

interface MineruTaskStatusData {
  task_id?: string;
  state?: string;
  markdown_url?: string;
  err_msg?: string;
}

interface MineruCreateFileTaskRequest {
  file_name: string;
  language: string;
  enable_table: boolean;
  is_ocr: boolean;
  enable_formula: boolean;
  page_range?: string;
}

export interface MineruAgentTransport {
  postJson<TResponse>(
    url: string,
    body: MineruCreateFileTaskRequest
  ): Promise<MineruApiResponse<TResponse>>;
  putBinary(url: string, body: Uint8Array): Promise<void>;
  getJson<TResponse>(url: string): Promise<MineruApiResponse<TResponse>>;
  getText(url: string): Promise<string>;
}

export interface MineruAgentProviderDependencies {
  transport?: MineruAgentTransport;
  readFile?: (path: string) => Promise<Uint8Array>;
}

class FetchMineruAgentTransport implements MineruAgentTransport {
  public constructor(private readonly apiKey?: string) {}

  public async postJson<TResponse>(
    url: string,
    body: MineruCreateFileTaskRequest
  ): Promise<MineruApiResponse<TResponse>> {
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    return this.readJsonResponse<TResponse>(response, "create MinerU task");
  }

  public async putBinary(url: string, body: Uint8Array): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      body
    });
    if (!response.ok) {
      throw this.error(`upload PDF to MinerU failed with HTTP ${response.status}`);
    }
  }

  public async getJson<TResponse>(url: string): Promise<MineruApiResponse<TResponse>> {
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers()
    });
    return this.readJsonResponse<TResponse>(response, "poll MinerU task");
  }

  public async getText(url: string): Promise<string> {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw this.error(`download MinerU markdown failed with HTTP ${response.status}`);
    }
    return response.text();
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.apiKey ? { ...extra, Authorization: `Bearer ${this.apiKey}` } : extra;
  }

  private async readJsonResponse<TResponse>(
    response: Response,
    action: string
  ): Promise<MineruApiResponse<TResponse>> {
    if (!response.ok) {
      throw this.error(`${action} failed with HTTP ${response.status}`);
    }
    return (await response.json()) as MineruApiResponse<TResponse>;
  }

  private error(message: string): AppError {
    return new AppError({
      code: "parse_failed",
      message,
      userMessage: "MinerU parsing failed."
    });
  }
}

export class MineruAgentProvider implements MineruProvider {
  public readonly backendName = "agent";
  private readonly transport: MineruAgentTransport;
  private readonly readLocalFile: (path: string) => Promise<Uint8Array>;

  public constructor(
    private readonly config: MineruAgentConfig,
    dependencies: MineruAgentProviderDependencies = {}
  ) {
    this.transport =
      dependencies.transport ?? new FetchMineruAgentTransport(this.config.apiKey);
    this.readLocalFile = dependencies.readFile ?? readFile;
  }

  public async parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput> {
    const fileName = basename(input.pdfPath);
    const createResponse = await this.transport.postJson<MineruCreateTaskData>(
      `${this.normalizedBaseUrl}/parse/file`,
      {
        file_name: fileName,
        language: "ch",
        enable_table: true,
        is_ocr: false,
        enable_formula: true
      }
    );
    const createData = this.readApiData(createResponse, "create MinerU file task");
    const taskId = createData.task_id;
    const fileUrl = createData.file_url;

    if (!taskId || !fileUrl) {
      throw this.parseError("MinerU task creation did not return task_id and file_url.");
    }

    await this.transport.putBinary(fileUrl, await this.readLocalFile(input.pdfPath));
    const markdownUrl = await this.pollForMarkdownUrl(taskId);
    const markdown = await this.transport.getText(markdownUrl);
    const stem = fileName.slice(0, fileName.length - extname(fileName).length);

    return {
      document: {
        docId: input.docId,
        zoteroItemKey: input.zoteroItemKey,
        title: input.title,
        markdown,
        blocks: []
      },
      rawFiles: [
        { name: `${stem}.md`, content: markdown },
        {
          name: `${stem}.mineru-task.json`,
          content: JSON.stringify({ taskId, markdownUrl }, null, 2)
        }
      ]
    };
  }

  private get normalizedBaseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }

  private async pollForMarkdownUrl(taskId: string): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 300_000;
    const pollIntervalMs = this.config.pollIntervalMs ?? 3_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const response = await this.transport.getJson<MineruTaskStatusData>(
        `${this.normalizedBaseUrl}/parse/${taskId}`
      );
      const data = this.readApiData(response, "poll MinerU task");

      if (data.state === "done" || data.state === "completed") {
        if (!data.markdown_url) {
          throw this.parseError("MinerU task completed without markdown_url.");
        }
        return data.markdown_url;
      }

      if (data.state === "failed") {
        throw this.parseError(data.err_msg ?? "MinerU task failed.");
      }

      await this.sleep(pollIntervalMs);
    }

    throw this.parseError(`MinerU task timed out after ${timeoutMs}ms.`);
  }

  private readApiData<TData>(
    response: MineruApiResponse<TData>,
    action: string
  ): TData {
    if (response.code !== 0 || !response.data) {
      throw this.parseError(response.msg ?? `MinerU ${action} failed.`);
    }
    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseError(message: string): AppError {
    return new AppError({
      code: "parse_failed",
      message,
      userMessage: "MinerU parsing failed."
    });
  }
}
