import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import type { MineruAgentConfig } from "./config.js";
import type { MineruProvider, ParsePdfInput, ParsePdfOutput } from "./client.js";
import { AppError } from "../utils/errors.js";

/**
 * MinerU Agent API envelope.
 *
 * 中文：MinerU 的 JSON 接口通常返回一个统一外壳：`code/msg/data`。
 * 这里把 `data` 做成泛型，是为了让“创建任务”和“查询任务”复用同一套响应校验逻辑。
 *
 * English: MinerU JSON endpoints return a common `code/msg/data` envelope.
 * `data` is generic so task creation and polling can share one validator.
 */
type MineruApiResponse<TData> = {
  code: number;
  msg?: string;
  data?: TData;
};

/**
 * Data returned after `POST /parse/file`.
 *
 * 中文：`task_id` 用于后续轮询；`file_url` 是临时签名上传地址。
 * 注意：上传 PDF 时不是传回 MinerU JSON API，而是 PUT 到这个签名 URL。
 *
 * English: `task_id` is used for polling; `file_url` is a signed upload URL.
 * The PDF upload goes to this signed URL, not to the JSON API endpoint.
 */
interface MineruCreateTaskData {
  task_id?: string;
  file_url?: string;
}

/**
 * Data returned while polling `GET /parse/{task_id}`.
 *
 * 中文：完成后返回 `markdown_url`，这是最终 Markdown 下载地址。
 * English: when complete, MinerU returns `markdown_url` for downloading output.
 */
interface MineruTaskStatusData {
  task_id?: string;
  state?: string;
  markdown_url?: string;
  err_msg?: string;
}

/**
 * Request body for creating a MinerU Agent file task.
 *
 * 中文参数说明：
 * - `file_name`：发送给 MinerU 的文件名，当前用 PDF basename。
 * - `language`：语言提示，当前默认 `ch`，适合中英文论文混合场景。
 * - `enable_table`：要求 MinerU 尝试解析表格。
 * - `is_ocr`：是否 OCR；当前默认 false，因为多数论文 PDF 有文本层。
 * - `enable_formula`：要求 MinerU 尝试解析公式。
 * - `page_range`：预留给后续只解析部分页码。
 *
 * English: this object mirrors MinerU Agent's file task request body.
 * Keep it narrow and explicit so new MinerU options are reviewed before use.
 */
interface MineruCreateFileTaskRequest {
  file_name: string;
  language: string;
  enable_table: boolean;
  is_ocr: boolean;
  enable_formula: boolean;
  page_range?: string;
}

/**
 * Transport abstraction for HTTP/file IO.
 *
 * 中文：这是经典的“依赖注入 / Dependency Injection”写法。
 * 生产环境默认用 `fetch` 和 `readFile`；测试时可以传入假 transport，
 * 从而不需要真正联网，也能验证请求顺序和返回解析。
 *
 * English: this is a dependency-injection seam.
 * Production uses fetch/readFile; tests can pass a fake transport to avoid network IO.
 */
export interface MineruAgentTransport {
  postJson<TResponse>(
    url: string,
    body: MineruCreateFileTaskRequest
  ): Promise<MineruApiResponse<TResponse>>;
  putBinary(url: string, body: Uint8Array): Promise<void>;
  getJson<TResponse>(url: string): Promise<MineruApiResponse<TResponse>>;
  getText(url: string): Promise<string>;
}

/**
 * Optional dependencies used by MinerUAgentProvider.
 *
 * 中文：后续如果 Zotero runtime 不能直接使用 Node `readFile`，可以在这里注入
 * Zotero 自己的文件读取实现，而不用改 provider 的业务逻辑。
 *
 * English: if Zotero runtime needs a non-Node file reader later, inject it here
 * without changing the provider's parse workflow.
 */
export interface MineruAgentProviderDependencies {
  transport?: MineruAgentTransport;
  readFile?: (path: string) => Promise<Uint8Array>;
}

/**
 * Default production transport backed by `fetch`.
 *
 * 中文知识点：这里把 HTTP 细节隔离在 transport 内，使 provider 只关心
 * “创建任务、上传、轮询、下载”这四个业务步骤。
 *
 * English concept: isolate HTTP mechanics inside a transport so the provider
 * can stay focused on the four workflow steps.
 */
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
    // 中文：只有 JSON API 需要 Authorization；签名上传 URL 不要额外加认证头。
    // English: only JSON API calls need Authorization; signed upload URLs do not.
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
    // 中文：`message` 给调试日志；`userMessage` 给用户界面，避免暴露内部细节。
    // English: `message` is diagnostic; `userMessage` is safe for UI display.
    return new AppError({
      code: "parse_failed",
      message,
      userMessage: "MinerU parsing failed."
    });
  }
}

/**
 * MinerU Agent provider implementation.
 *
 * 中文：这是 MinerU 解析层的核心入口，实现 `MineruProvider` 接口。
 * 它把一个本地 PDF 变成 `RawMineruDocument + rawFiles`：
 * 1. 创建 MinerU task；
 * 2. 上传 PDF 到签名 URL；
 * 3. 轮询 task；
 * 4. 下载 Markdown；
 * 5. 返回给 parse-service 做预处理和归一化。
 *
 * English: core MinerU parsing entry implementing `MineruProvider`.
 * It turns one local PDF into raw Markdown plus metadata files.
 *
 * Later extension:
 * 中文：如果要接 Standard API 或本地 MinerU，只需要实现同一个 `MineruProvider`。
 * English: Standard API/local MinerU can be added by implementing the same interface.
 */
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

    // 中文：第 1 步，向 MinerU 创建任务。这里不要上传文件内容，只传文件名和解析参数。
    // English: Step 1, create a task. The file content is not uploaded in this request.
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

    // 中文：第 2 步，把 PDF 二进制 PUT 到签名 URL。不要设置额外 Content-Type。
    // English: Step 2, PUT the PDF bytes to the signed URL. Avoid extra Content-Type.
    await this.transport.putBinary(fileUrl, await this.readLocalFile(input.pdfPath));

    // 中文：第 3-4 步，轮询任务直到 MinerU 给出 markdown_url，然后下载 Markdown。
    // English: Step 3-4, poll until `markdown_url` exists, then download Markdown.
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
        // 中文：与 PDF 同名的 Markdown 是人类可读主产物。
        // English: same-stem Markdown is the primary human-readable output.
        { name: `${stem}.md`, content: markdown },
        {
          // 中文：保存 task 元数据方便排错和追踪 MinerU 输出来源。
          // English: task metadata helps debug and trace the MinerU output source.
          name: `${stem}.mineru-task.json`,
          content: JSON.stringify({ taskId, markdownUrl }, null, 2)
        }
      ]
    };
  }

  private get normalizedBaseUrl(): string {
    // 中文：去掉尾部斜杠，避免拼 URL 时出现双斜杠。
    // English: strip trailing slashes to avoid double slashes in endpoint URLs.
    return this.config.baseUrl.replace(/\/+$/, "");
  }

  private async pollForMarkdownUrl(taskId: string): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 300_000;
    const pollIntervalMs = this.config.pollIntervalMs ?? 3_000;
    const startedAt = Date.now();

    // 中文：轮询是解析类 API 的常见模式：提交任务后，服务端异步处理。
    // English: polling is common for parse APIs: submit now, process asynchronously.
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

      // 中文：等待固定间隔，避免高频请求打爆 API。
      // English: wait between polls to avoid hammering the API.
      await this.sleep(pollIntervalMs);
    }

    throw this.parseError(`MinerU task timed out after ${timeoutMs}ms.`);
  }

  private readApiData<TData>(
    response: MineruApiResponse<TData>,
    action: string
  ): TData {
    // 中文：统一检查 MinerU 的业务 code，而不仅仅是 HTTP 200。
    // English: validate MinerU's business `code`, not just HTTP 200.
    if (response.code !== 0 || !response.data) {
      throw this.parseError(response.msg ?? `MinerU ${action} failed.`);
    }
    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    // 中文：Promise 包装 setTimeout，是 JS/TS 中常见的 async sleep 写法。
    // English: Promise-wrapped setTimeout is the standard async sleep pattern.
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
