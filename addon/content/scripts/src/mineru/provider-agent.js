import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { AppError } from "../utils/errors.js";
import { defaultLogger } from "../utils/logger.js";
/**
 * Default production transport backed by `fetch`.
 *
 * 中文知识点：这里把 HTTP 细节隔离在 transport 内，使 provider 只关心
 * “创建任务、上传、轮询、下载”这四个业务步骤。
 *
 * English concept: isolate HTTP mechanics inside a transport so the provider
 * can stay focused on the four workflow steps.
 */
class FetchMineruAgentTransport {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async postJson(url, body) {
        const response = await fetch(url, {
            method: "POST",
            headers: this.headers({ "Content-Type": "application/json" }),
            body: JSON.stringify(body)
        });
        return this.readJsonResponse(response, "create MinerU task");
    }
    async putBinary(url, body) {
        const response = await fetch(url, {
            method: "PUT",
            body: body
        });
        if (!response.ok) {
            throw this.error(`upload PDF to MinerU failed with HTTP ${response.status}`);
        }
    }
    async getJson(url) {
        const response = await fetch(url, {
            method: "GET",
            headers: this.headers()
        });
        return this.readJsonResponse(response, "poll MinerU task");
    }
    async getText(url) {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
            throw this.error(`download MinerU markdown failed with HTTP ${response.status}`);
        }
        return response.text();
    }
    headers(extra = {}) {
        // 中文：只有 JSON API 需要 Authorization；签名上传 URL 不要额外加认证头。
        // English: only JSON API calls need Authorization; signed upload URLs do not.
        return this.apiKey ? { ...extra, Authorization: `Bearer ${this.apiKey}` } : extra;
    }
    async readJsonResponse(response, action) {
        if (!response.ok) {
            throw this.error(`${action} failed with HTTP ${response.status}`);
        }
        return (await response.json());
    }
    error(message) {
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
export class MineruAgentProvider {
    config;
    backendName = "agent";
    transport;
    readLocalFile;
    constructor(config, dependencies = {}) {
        this.config = config;
        this.transport =
            dependencies.transport ?? new FetchMineruAgentTransport(this.config.apiKey);
        this.readLocalFile = dependencies.readFile ?? readFile;
    }
    async parsePdf(input) {
        const fileName = basename(input.pdfPath);
        defaultLogger.info("开始 MinerU Agent 解析", { pdfPath: input.pdfPath, fileName });
        // 中文：第 1 步，向 MinerU 创建任务。这里不要上传文件内容，只传文件名和解析参数。
        // English: Step 1, create a task. The file content is not uploaded in this request.
        const createResponse = await this.transport.postJson(`${this.normalizedBaseUrl}/parse/file`, {
            file_name: fileName,
            language: "ch",
            enable_table: true,
            is_ocr: false,
            enable_formula: true
        });
        const createData = this.readApiData(createResponse, "create MinerU file task");
        const taskId = createData.task_id;
        const fileUrl = createData.file_url;
        defaultLogger.info("MinerU Agent 任务创建成功", { taskId, fileUrl });
        if (!taskId || !fileUrl) {
            throw this.parseError("MinerU task creation did not return task_id and file_url.");
        }
        // 中文：第 2 步，把 PDF 二进制 PUT 到签名 URL。不要设置额外 Content-Type。
        // English: Step 2, PUT the PDF bytes to the signed URL. Avoid extra Content-Type.
        defaultLogger.info("开始上传 PDF 到 MinerU", { fileUrl, pdfPath: input.pdfPath });
        await this.transport.putBinary(fileUrl, await this.readLocalFile(input.pdfPath));
        defaultLogger.info("PDF 上传完成", { fileUrl });
        // 中文：第 3-4 步，轮询任务直到 MinerU 给出 markdown_url，然后下载 Markdown。
        // English: Step 3-4, poll until `markdown_url` exists, then download Markdown.
        defaultLogger.info("开始轮询 MinerU 任务状态", { taskId });
        const markdownUrl = await this.pollForMarkdownUrl(taskId);
        defaultLogger.info("MinerU 任务完成，开始下载 Markdown", { taskId, markdownUrl });
        const markdown = await this.transport.getText(markdownUrl);
        defaultLogger.info("Markdown 下载完成", { taskId, markdownLength: markdown.length });
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
    get normalizedBaseUrl() {
        // 中文：去掉尾部斜杠，避免拼 URL 时出现双斜杠。
        // English: strip trailing slashes to avoid double slashes in endpoint URLs.
        return this.config.baseUrl.replace(/\/+$/, "");
    }
    async pollForMarkdownUrl(taskId) {
        const timeoutMs = this.config.timeoutMs ?? 300_000;
        const pollIntervalMs = this.config.pollIntervalMs ?? 3_000;
        const startedAt = Date.now();
        // 中文：轮询是解析类 API 的常见模式：提交任务后，服务端异步处理。
        // English: polling is common for parse APIs: submit now, process asynchronously.
        while (Date.now() - startedAt <= timeoutMs) {
            const response = await this.transport.getJson(`${this.normalizedBaseUrl}/parse/${taskId}`);
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
    readApiData(response, action) {
        // 中文：统一检查 MinerU 的业务 code，而不仅仅是 HTTP 200。
        // English: validate MinerU's business `code`, not just HTTP 200.
        if (response.code !== 0 || !response.data) {
            throw this.parseError(response.msg ?? `MinerU ${action} failed.`);
        }
        return response.data;
    }
    sleep(ms) {
        // 中文：Promise 包装 setTimeout，是 JS/TS 中常见的 async sleep 写法。
        // English: Promise-wrapped setTimeout is the standard async sleep pattern.
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    parseError(message) {
        return new AppError({
            code: "parse_failed",
            message,
            userMessage: "MinerU parsing failed."
        });
    }
}
