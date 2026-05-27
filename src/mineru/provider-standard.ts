import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import type { MineruStandardConfig } from "./config.js";
import type { MineruProvider, ParsePdfInput, ParsePdfOutput } from "./client.js";
import { AppError } from "../utils/errors.js";

/**
 * MinerU Standard API envelope.
 *
 * 中文：MinerU 精准解析 API 的 JSON 接口返回统一外壳：`code/msg/data`。
 * 这里把 `data` 做成泛型，是为了让"创建任务"和"查询任务"复用同一套响应校验逻辑。
 *
 * English: MinerU Standard API JSON endpoints return a common `code/msg/data` envelope.
 * `data` is generic so task creation and polling can share one validator.
 */
type MineruApiResponse<TData> = {
  code: number;
  msg?: string;
  data?: TData;
};

/**
 * Data returned after `POST /api/v4/extract/task`.
 *
 * 中文：`task_id` 用于后续轮询。
 * English: `task_id` is used for polling.
 */
interface MineruCreateTaskData {
  task_id?: string;
}

/**
 * Data returned while polling `GET /api/v4/extract/task/{task_id}`.
 *
 * 中文：完成后返回 `full_zip_url`，这是最终结果压缩包下载地址。
 * English: when complete, MinerU returns `full_zip_url` for downloading output.
 */
interface MineruTaskStatusData {
  task_id?: string;
  state?: string;
  full_zip_url?: string;
  err_msg?: string;
}

/**
 * Request body for creating a MinerU Standard task.
 *
 * 中文参数说明：
 * - `url`：文件下载链接（必需）。
 * - `model_version`：模型版本，pipeline（默认）、vlm（推荐）、MinerU-HTML。
 * - `is_ocr`：是否开启 OCR。
 * - `enable_formula`：是否开启公式识别。
 * - `enable_table`：是否开启表格识别。
 * - `language`：文档语言，默认 ch（中英文）。
 * - `page_ranges`：页码范围，如 "1-5,8"。
 * - `extra_formats`：额外导出格式，如 ["docx", "html"]。
 *
 * English: this object mirrors MinerU Standard's task request body.
 */
interface MineruCreateTaskRequest {
  url: string;
  model_version?: string;
  is_ocr?: boolean;
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  page_ranges?: string;
  extra_formats?: string[];
}

/**
 * Transport abstraction for HTTP/file IO.
 *
 * 中文：这是经典的"依赖注入 / Dependency Injection"写法。
 * 生产环境默认用 `fetch` 和 `readFile`；测试时可以传入假 transport，
 * 从而不需要真正联网，也能验证请求顺序和返回解析。
 *
 * English: this is a dependency-injection seam.
 * Production uses fetch/readFile; tests can pass a fake transport to avoid network IO.
 */
export interface MineruStandardTransport {
  postJson<TResponse>(
    url: string,
    body: MineruCreateTaskRequest
  ): Promise<MineruApiResponse<TResponse>>;
  getJson<TResponse>(url: string): Promise<MineruApiResponse<TResponse>>;
  getBinary(url: string): Promise<Uint8Array>;
}

/**
 * Optional dependencies used by MineruStandardProvider.
 *
 * 中文：后续如果 Zotero runtime 不能直接使用 Node `readFile`，可以在这里注入
 * Zotero 自己的文件读取实现，而不用改 provider 的业务逻辑。
 *
 * English: if Zotero runtime needs a non-Node file reader later, inject it here
 * without changing the provider's parse workflow.
 */
export interface MineruStandardProviderDependencies {
  transport?: MineruStandardTransport;
  readFile?: (path: string) => Promise<Uint8Array>;
}

/**
 * Default production transport backed by `fetch`.
 *
 * 中文知识点：这里把 HTTP 细节隔离在 transport 内，使 provider 只关心
 * "创建任务、轮询、下载"这三个业务步骤。
 *
 * English concept: isolate HTTP mechanics inside a transport so the provider
 * can stay focused on the three workflow steps.
 */
class FetchMineruStandardTransport implements MineruStandardTransport {
  public constructor(private readonly apiKey: string) {}

  public async postJson<TResponse>(
    url: string,
    body: MineruCreateTaskRequest
  ): Promise<MineruApiResponse<TResponse>> {
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    return this.readJsonResponse<TResponse>(response, "create MinerU task");
  }

  public async getJson<TResponse>(url: string): Promise<MineruApiResponse<TResponse>> {
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers()
    });
    return this.readJsonResponse<TResponse>(response, "poll MinerU task");
  }

  public async getBinary(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw this.error(`download MinerU result failed with HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...extra, Authorization: `Bearer ${this.apiKey}` };
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

/**
 * MinerU Standard provider implementation.
 *
 * 中文：这是 MinerU 精准解析层的核心入口，实现 `MineruProvider` 接口。
 * 它把一个本地 PDF 变成 `RawMineruDocument + rawFiles`：
 * 1. 上传 PDF 到临时 URL；
 * 2. 创建 MinerU task；
 * 3. 轮询 task；
 * 4. 下载结果 ZIP 包；
 * 5. 解析 ZIP 包，提取 Markdown 和其他文件；
 * 6. 返回给 parse-service 做预处理和归一化。
 *
 * English: core MinerU Standard parsing entry implementing `MineruProvider`.
 * It turns one local PDF into raw Markdown plus metadata files.
 *
 * 后续扩展 / Future extension:
 * 中文：如果要接本地 MinerU，只需要实现同一个 `MineruProvider`。
 * English: local MinerU can be added by implementing the same interface.
 */
export class MineruStandardProvider implements MineruProvider {
  public readonly backendName = "standard";
  private readonly transport: MineruStandardTransport;
  private readonly readLocalFile: (path: string) => Promise<Uint8Array>;

  public constructor(
    private readonly config: MineruStandardConfig,
    dependencies: MineruStandardProviderDependencies = {}
  ) {
    this.transport =
      dependencies.transport ?? new FetchMineruStandardTransport(this.config.apiKey);
    this.readLocalFile = dependencies.readFile ?? readFile;
  }

  public async parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput> {
    const fileName = basename(input.pdfPath);
    const stem = fileName.slice(0, fileName.length - extname(fileName).length);

    // 中文：第 1 步，上传 PDF 到临时 URL（这里简化处理，实际可能需要先获取上传 URL）。
    // English: Step 1, upload PDF to temporary URL (simplified here, may need to get upload URL first).
    // 注意：MinerU Standard API 需要文件下载链接，这里假设文件已经可访问。
    // 如果文件不可访问，需要先上传到可访问的存储服务。
    const fileUrl = await this.uploadPdfToAccessibleUrl(input.pdfPath);

    // 中文：第 2 步，向 MinerU 创建任务。
    // English: Step 2, create a task.
    const createResponse = await this.transport.postJson<MineruCreateTaskData>(
      `${this.normalizedBaseUrl}/extract/task`,
      {
        url: fileUrl,
        model_version: this.config.modelVersion ?? "vlm",
        is_ocr: this.config.isOcr ?? false,
        enable_formula: this.config.enableFormula ?? true,
        enable_table: this.config.enableTable ?? true,
        language: this.config.language ?? "ch",
        page_ranges: this.config.pageRanges,
        extra_formats: this.config.extraFormats
      }
    );
    const createData = this.readApiData(createResponse, "create MinerU task");
    const taskId = createData.task_id;

    if (!taskId) {
      throw this.parseError("MinerU task creation did not return task_id.");
    }

    // 中文：第 3 步，轮询任务直到完成。
    // English: Step 3, poll until task completes.
    const resultZipUrl = await this.pollForResultUrl(taskId);

    // 中文：第 4 步，下载结果 ZIP 包。
    // English: Step 4, download result ZIP package.
    const zipData = await this.transport.getBinary(resultZipUrl);

    // 中文：第 5 步，解析 ZIP 包，提取 Markdown 和其他文件。
    // English: Step 5, parse ZIP package, extract Markdown and other files.
    const { markdown, rawFiles } = await this.parseZipPackage(zipData, stem);

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
          content: JSON.stringify({ taskId, resultZipUrl }, null, 2)
        },
        ...rawFiles
      ]
    };
  }

  private get normalizedBaseUrl(): string {
    // 中文：去掉尾部斜杠，避免拼 URL 时出现双斜杠。
    // English: strip trailing slashes to avoid double slashes in endpoint URLs.
    return this.config.baseUrl.replace(/\/+$/, "");
  }

  private async uploadPdfToAccessibleUrl(pdfPath: string): Promise<string> {
    // 中文：这里简化处理，假设文件已经可访问。
    // 实际实现可能需要：
    // 1. 调用 MinerU 获取上传 URL
    // 2. 上传文件到该 URL
    // 3. 返回可访问的 URL
    // English: Simplified here, assumes file is already accessible.
    // Actual implementation may need:
    // 1. Call MinerU to get upload URL
    // 2. Upload file to that URL
    // 3. Return accessible URL
    
    // 临时方案：使用 file:// 协议（仅用于本地测试）
    // 实际生产环境需要上传到可访问的存储服务
    return `file://${pdfPath}`;
  }

  private async pollForResultUrl(taskId: string): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 300_000;
    const pollIntervalMs = this.config.pollIntervalMs ?? 3_000;
    const startedAt = Date.now();

    // 中文：轮询是解析类 API 的常见模式：提交任务后，服务端异步处理。
    // English: polling is common for parse APIs: submit now, process asynchronously.
    while (Date.now() - startedAt <= timeoutMs) {
      const response = await this.transport.getJson<MineruTaskStatusData>(
        `${this.normalizedBaseUrl}/extract/task/${taskId}`
      );
      const data = this.readApiData(response, "poll MinerU task");

      if (data.state === "done" || data.state === "completed") {
        if (!data.full_zip_url) {
          throw this.parseError("MinerU task completed without full_zip_url.");
        }
        return data.full_zip_url;
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

  private async parseZipPackage(
    zipData: Uint8Array,
    stem: string
  ): Promise<{ markdown: string; rawFiles: { name: string; content: string }[] }> {
    // 中文：解析 ZIP 包，提取 Markdown 和其他文件。
    // 这里需要使用 ZIP 解析库，如 jszip 或 unzipper。
    // 由于 Zotero 环境可能没有这些库，我们需要一个简单的实现。
    // English: Parse ZIP package, extract Markdown and other files.
    // Need to use ZIP parsing library like jszip or unzipper.
    // Since Zotero environment may not have these libraries, we need a simple implementation.
    
    // 临时方案：返回空结果，实际实现需要解析 ZIP
    // Temporary solution: return empty result, actual implementation needs ZIP parsing
    
    // TODO: 实现 ZIP 解析
    // 1. 使用 jszip 或类似库解析 ZIP
    // 2. 提取 Markdown 文件（通常是 full.md 或类似）
    // 3. 提取其他文件（JSON、图片等）
    // 4. 返回解析结果
    
    return {
      markdown: "",
      rawFiles: []
    };
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