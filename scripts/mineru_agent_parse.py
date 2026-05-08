from __future__ import annotations

import argparse
import json
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


class HttpResponse(Protocol):
    """Minimal HTTP response contract used by the MinerU client.

    中文：这里用 `Protocol` 而不是具体 requests/urllib 类型，是为了让测试可以注入
    fake response，也方便未来把 urllib 换成 requests/httpx。

    English: `Protocol` keeps the client independent from urllib/requests/httpx
    and lets tests inject fake responses with the same shape.
    """

    status_code: int
    text: str

    def json(self) -> dict[str, Any]:
        ...


class HttpTransport(Protocol):
    """Transport boundary for network I/O.

    中文：MinerUAgentClient 只描述“业务流程”，不直接依赖 urllib 的细节。
    经典分层知识点：把网络 I/O 抽象成接口，可以让单元测试不访问真实网络。

    English: MinerUAgentClient describes the business flow while this interface
    hides network details. This is the standard dependency-inversion pattern for
    testable API clients.
    """

    def post_json(self, url: str, payload: dict[str, Any]) -> HttpResponse:
        ...

    def put_file(self, url: str, file_path: Path) -> HttpResponse:
        ...

    def get_json(self, url: str) -> HttpResponse:
        ...

    def get_text(self, url: str) -> HttpResponse:
        ...


@dataclass(frozen=True)
class UrllibResponse:
    """Small immutable wrapper around urllib response data.

    中文：`frozen=True` 表示对象创建后不可修改，避免调试时 response 状态被意外改写。
    English: `frozen=True` makes the wrapper immutable after construction.
    """

    status_code: int
    text: str

    def json(self) -> dict[str, Any]:
        return json.loads(self.text)


class UrllibTransport:
    """Default stdlib HTTP implementation.

    中文：脚本只用 Python 标准库，避免用户为了试跑 MinerU 核心链路先安装额外依赖。
    English: this uses only the Python standard library so the debug workflow
    does not require installing third-party packages.
    """

    def post_json(self, url: str, payload: dict[str, Any]) -> UrllibResponse:
        # 中文：MinerU 创建任务接口接收 JSON；English: MinerU task creation accepts JSON.
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        return self._open(request)

    def put_file(self, url: str, file_path: Path) -> UrllibResponse:
        # 中文：Agent API 返回的是预签名上传 URL，通常要求 PUT 原始文件字节。
        # English: Agent API returns a signed upload URL that expects raw file bytes.
        request = urllib.request.Request(
            url,
            data=file_path.read_bytes(),
            method="PUT",
            # 中文：这里显式清空 Content-Type，匹配 MinerU/OSS 预签名上传的要求。
            # English: empty Content-Type matches MinerU/OSS signed upload requirements.
            headers={"Content-Type": ""},
        )
        return self._open(request)

    def get_json(self, url: str) -> UrllibResponse:
        # 中文：用于轮询任务状态；English: used to poll task status.
        request = urllib.request.Request(url, method="GET")
        return self._open(request)

    def get_text(self, url: str) -> UrllibResponse:
        # 中文：用于下载 markdown 文本；English: used to download Markdown text.
        request = urllib.request.Request(url, method="GET")
        return self._open(request)

    def _open(self, request: urllib.request.Request) -> UrllibResponse:
        with urllib.request.urlopen(request) as response:
            text = response.read().decode("utf-8")
            return UrllibResponse(status_code=response.status, text=text)


class MineruAgentError(RuntimeError):
    """User-facing MinerU workflow error.

    中文：统一抛这个异常，CLI 和测试就能稳定断言错误原因。
    English: a single error type makes CLI handling and tests predictable.
    """

    pass


class MineruAgentClient:
    """Minimal MinerU Agent API client for the core PDF -> Markdown workflow.

    中文：这是先用 Python 打通核心链路的脚本版实现。它对应插件里的
    TypeScript `MineruAgentProvider`，流程保持一致：
    create task -> upload PDF -> poll -> download markdown。

    English: this script-level client mirrors the TypeScript provider flow:
    create task -> upload PDF -> poll -> download Markdown.
    """

    def __init__(
        self,
        base_url: str = "https://mineru.net/api/v1/agent",
        http: HttpTransport | None = None,
        timeout_seconds: int = 300,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.http = http or UrllibTransport()
        self.timeout_seconds = timeout_seconds

    def parse_file(
        self,
        pdf_path: Path,
        *,
        language: str = "ch",
        page_range: str | None = None,
        enable_table: bool = True,
        is_ocr: bool = False,
        enable_formula: bool = True,
        poll_interval_seconds: float = 3,
    ) -> str:
        """Parse a PDF and return Markdown content.

        中文参数说明：
        - `language="ch"`：MinerU 文档里常用的语言参数；对英文论文也可让 MinerU 自动处理。
        - `page_range=None`：默认全文解析；可传类似 `"1-3"` 做局部调试。
        - `enable_table=True`：尝试识别表格。
        - `is_ocr=False`：默认不强制 OCR，优先文本层；扫描件可改为 True。
        - `enable_formula=True`：保留公式识别。
        - `poll_interval_seconds=3`：轮询间隔，太短可能浪费请求，太长会让调试慢。

        English: creates a task, uploads the file, waits until MinerU finishes,
        and returns the downloaded Markdown.
        """

        task_id, file_url = self._create_file_task(
            pdf_path.name,
            language=language,
            page_range=page_range,
            enable_table=enable_table,
            is_ocr=is_ocr,
            enable_formula=enable_formula,
        )
        self._upload_file(file_url, pdf_path)
        markdown_url = self._poll_markdown_url(task_id, poll_interval_seconds)
        return self._download_markdown(markdown_url)

    def _create_file_task(
        self,
        file_name: str,
        *,
        language: str,
        page_range: str | None,
        enable_table: bool,
        is_ocr: bool,
        enable_formula: bool,
    ) -> tuple[str, str]:
        """Create a MinerU file parse task and return task/upload URLs.

        中文：只在 `page_range` 有值时发送它，避免把空字符串误传给 API。
        English: include `page_range` only when set, avoiding ambiguous empty values.
        """

        payload: dict[str, Any] = {
            "file_name": file_name,
            "language": language,
            "enable_table": enable_table,
            "is_ocr": is_ocr,
            "enable_formula": enable_formula,
        }
        if page_range:
            payload["page_range"] = page_range

        response = self.http.post_json(f"{self.base_url}/parse/file", payload)
        body = self._read_api_json(response, "create file parse task")
        data = body.get("data") or {}
        task_id = data.get("task_id")
        file_url = data.get("file_url")
        if not isinstance(task_id, str) or not isinstance(file_url, str):
            raise MineruAgentError("MinerU response did not include task_id and file_url.")
        return task_id, file_url

    def _upload_file(self, file_url: str, pdf_path: Path) -> None:
        """Upload local PDF bytes to MinerU's signed file URL."""

        response = self.http.put_file(file_url, pdf_path)
        if response.status_code not in (200, 201):
            raise MineruAgentError(f"MinerU file upload failed with HTTP {response.status_code}.")

    def _poll_markdown_url(self, task_id: str, poll_interval_seconds: float) -> str:
        """Poll MinerU until it returns a Markdown download URL.

        中文：使用 `time.monotonic()` 而不是 `time.time()`，因为 monotonic 不受系统时间
        调整影响，更适合计算超时。

        English: uses `time.monotonic()` because timeout calculations should not
        be affected by wall-clock changes.
        """

        started_at = time.monotonic()
        while time.monotonic() - started_at <= self.timeout_seconds:
            response = self.http.get_json(f"{self.base_url}/parse/{task_id}")
            body = self._read_api_json(response, "poll parse task")
            data = body.get("data") or {}
            state = data.get("state")

            if state == "done":
                markdown_url = data.get("markdown_url")
                if not isinstance(markdown_url, str):
                    raise MineruAgentError("MinerU completed without markdown_url.")
                return markdown_url

            if state == "failed":
                raise MineruAgentError(str(data.get("err_msg") or "MinerU parse failed."))

            time.sleep(poll_interval_seconds)

        raise MineruAgentError(f"MinerU parse timed out after {self.timeout_seconds}s.")

    def _download_markdown(self, markdown_url: str) -> str:
        """Download the final Markdown body from MinerU."""

        response = self.http.get_text(markdown_url)
        if response.status_code != 200:
            raise MineruAgentError(
                f"MinerU markdown download failed with HTTP {response.status_code}."
            )
        return response.text

    def _read_api_json(self, response: HttpResponse, action: str) -> dict[str, Any]:
        """Validate MinerU's HTTP and business-level response envelope.

        中文：很多 API 同时有 HTTP 状态码和业务状态码。这里先检查 HTTP 200，
        再检查 JSON 里的 `code == 0`，否则抛出带上下文的错误。

        English: checks both HTTP status and MinerU's JSON business code so
        failures are reported with actionable context.
        """

        if response.status_code != 200:
            raise MineruAgentError(f"MinerU {action} failed with HTTP {response.status_code}.")

        body = response.json()
        if body.get("code") != 0:
            raise MineruAgentError(str(body.get("msg") or f"MinerU {action} failed."))
        return body


def parse_pdf_to_sibling_markdown(
    pdf_path: str | Path,
    client: MineruAgentClient | None = None,
    *,
    poll_interval_seconds: float = 3,
) -> Path:
    """Parse a PDF and write `<same-folder>/<same-name>.md`.

    中文：这是用户要求的最小可验证核心工作流：输入一个 PDF 路径，输出同目录同名
    Markdown。插件集成时也遵循相同命名策略，便于人工验证和版本管理。

    English: this is the smallest verifiable workflow requested by the user:
    input one PDF path and write a sibling Markdown file with the same base name.
    """

    source_pdf = Path(pdf_path).expanduser().resolve()
    if source_pdf.suffix.lower() != ".pdf":
        raise MineruAgentError(f"Expected a PDF file, got: {source_pdf}")
    if not source_pdf.exists():
        raise MineruAgentError(f"PDF file does not exist: {source_pdf}")

    mineru_client = client or MineruAgentClient()
    markdown = mineru_client.parse_file(
        source_pdf,
        poll_interval_seconds=poll_interval_seconds,
    )
    output_path = source_pdf.with_suffix(".md")
    output_path.write_text(markdown, encoding="utf-8")
    return output_path


def main() -> None:
    """CLI entrypoint for manual MinerU debugging.

    中文：示例：
    `python scripts/mineru_agent_parse.py /path/to/paper.pdf --poll-interval 3 --timeout 300`

    English: this entrypoint is intentionally thin; all testable behavior lives
    in `MineruAgentClient` and `parse_pdf_to_sibling_markdown`.
    """

    parser = argparse.ArgumentParser(
        description="Parse a local PDF with MinerU Agent API and save sibling Markdown."
    )
    parser.add_argument("pdf_path", help="Path to the local PDF file.")
    parser.add_argument(
        "--base-url",
        default="https://mineru.net/api/v1/agent",
        help="MinerU Agent API base URL.",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=3,
        help="Polling interval in seconds.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Polling timeout in seconds.",
    )
    args = parser.parse_args()

    client = MineruAgentClient(base_url=args.base_url, timeout_seconds=args.timeout)
    output_path = parse_pdf_to_sibling_markdown(
        args.pdf_path,
        client,
        poll_interval_seconds=args.poll_interval,
    )
    print(output_path)


if __name__ == "__main__":
    main()
