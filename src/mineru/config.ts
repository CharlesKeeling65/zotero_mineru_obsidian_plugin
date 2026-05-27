/**
 * Configuration for MinerU Agent API.
 *
 * 中文：Agent API 当前核心流程是“创建任务 -> 上传文件 -> 轮询任务 -> 下载 Markdown”。
 * `pollIntervalMs` 只对这种异步任务流有意义。
 *
 * English: Agent API is asynchronous: create task -> upload file -> poll ->
 * download Markdown. `pollIntervalMs` belongs to that polling flow.
 */
export interface MineruAgentConfig {
  /** 中文：例如 https://mineru.net/api/v1/agent；English: Agent API base URL. */
  baseUrl: string;
  /** 中文：如 MinerU 后续要求鉴权，在这里传入；English: optional API key. */
  apiKey?: string;
  /** 中文：整体解析超时，毫秒；English: total parse timeout in milliseconds. */
  timeoutMs?: number;
  /** 中文：轮询间隔，毫秒；English: polling interval in milliseconds. */
  pollIntervalMs?: number;
}

/**
 * Configuration for MinerU Standard (精准解析) API.
 *
 * 中文：精准解析 API 支持高精度、深度结构化、多模态支持（表格/公式/图片）、复杂版式适应。
 * 需要申请 Token，支持单文件/批量、表格/公式/多格式输出。
 *
 * English: Standard API supports high-precision, deep structured, multimodal support
 * (tables/formulas/images), complex layout adaptation. Requires Token application,
 * supports single file/batch, tables/formulas/multiple output formats.
 */
export interface MineruStandardConfig {
  /** 中文：例如 https://mineru.net/api/v4；English: Standard API base URL. */
  baseUrl: string;
  /** 中文：必需的 API Token；English: required API Token for authentication. */
  apiKey: string;
  /** 中文：整体解析超时，毫秒；English: total parse timeout in milliseconds. */
  timeoutMs?: number;
  /** 中文：轮询间隔，毫秒；English: polling interval in milliseconds. */
  pollIntervalMs?: number;
  /** 中文：模型版本：pipeline（默认）、vlm（推荐）、MinerU-HTML；English: model version. */
  modelVersion?: "pipeline" | "vlm" | "MinerU-HTML";
  /** 中文：是否开启 OCR；English: whether to enable OCR. */
  isOcr?: boolean;
  /** 中文：是否开启公式识别；English: whether to enable formula recognition. */
  enableFormula?: boolean;
  /** 中文：是否开启表格识别；English: whether to enable table recognition. */
  enableTable?: boolean;
  /** 中文：文档语言，默认 ch（中英文）；English: document language, default ch. */
  language?: string;
  /** 中文：页码范围，如 "1-5,8"；English: page ranges, e.g., "1-5,8". */
  pageRanges?: string;
  /** 中文：额外导出格式，如 ["docx", "html"]；English: extra export formats. */
  extraFormats?: string[];
}
