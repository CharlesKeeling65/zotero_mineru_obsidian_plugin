from __future__ import annotations

import argparse
import json
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


class HttpResponse(Protocol):
    status_code: int
    text: str

    def json(self) -> dict[str, Any]:
        ...


class HttpTransport(Protocol):
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
    status_code: int
    text: str

    def json(self) -> dict[str, Any]:
        return json.loads(self.text)


class UrllibTransport:
    def post_json(self, url: str, payload: dict[str, Any]) -> UrllibResponse:
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        return self._open(request)

    def put_file(self, url: str, file_path: Path) -> UrllibResponse:
        request = urllib.request.Request(
            url,
            data=file_path.read_bytes(),
            method="PUT",
            headers={"Content-Type": ""},
        )
        return self._open(request)

    def get_json(self, url: str) -> UrllibResponse:
        request = urllib.request.Request(url, method="GET")
        return self._open(request)

    def get_text(self, url: str) -> UrllibResponse:
        request = urllib.request.Request(url, method="GET")
        return self._open(request)

    def _open(self, request: urllib.request.Request) -> UrllibResponse:
        with urllib.request.urlopen(request) as response:
            text = response.read().decode("utf-8")
            return UrllibResponse(status_code=response.status, text=text)


class MineruAgentError(RuntimeError):
    pass


class MineruAgentClient:
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
        response = self.http.put_file(file_url, pdf_path)
        if response.status_code not in (200, 201):
            raise MineruAgentError(f"MinerU file upload failed with HTTP {response.status_code}.")

    def _poll_markdown_url(self, task_id: str, poll_interval_seconds: float) -> str:
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
        response = self.http.get_text(markdown_url)
        if response.status_code != 200:
            raise MineruAgentError(
                f"MinerU markdown download failed with HTTP {response.status_code}."
            )
        return response.text

    def _read_api_json(self, response: HttpResponse, action: str) -> dict[str, Any]:
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
