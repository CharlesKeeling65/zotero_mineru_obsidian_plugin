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
 * Placeholder configuration for future MinerU Standard API.
 *
 * 中文：保留这个接口是为了让 provider 抽象前向兼容，但当前批次不实现 Standard API。
 * English: reserved for a future Standard API provider; not implemented in the
 * current core workflow.
 */
export interface MineruStandardConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}
