import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.mineru_agent_parse import (
    MineruAgentClient,
    UrllibResponse,
    UrllibTransport,
    parse_pdf_to_sibling_markdown,
)


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text

    def json(self):
        return self._json_data


class FakeHttp:
    def __init__(self):
        self.calls = []

    def post_json(self, url, payload):
        self.calls.append(("POST", url, payload))
        return FakeResponse(
            json_data={
                "code": 0,
                "msg": "ok",
                "data": {"task_id": "task-1", "file_url": "https://upload.example/pdf"},
            }
        )

    def put_file(self, url, file_path):
        self.calls.append(("PUT", url, Path(file_path).name))
        return FakeResponse(status_code=200)

    def get_json(self, url):
        self.calls.append(("GET_JSON", url, None))
        return FakeResponse(
            json_data={
                "code": 0,
                "msg": "ok",
                "data": {
                    "task_id": "task-1",
                    "state": "done",
                    "markdown_url": "https://cdn.example/full.md",
                },
            }
        )

    def get_text(self, url):
        self.calls.append(("GET_TEXT", url, None))
        return FakeResponse(text="# Parsed paper\n")


class MineruAgentParseTest(unittest.TestCase):
    def test_parse_pdf_to_sibling_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf_path = Path(tmp) / "paper.pdf"
            pdf_path.write_bytes(b"%PDF-1.7")
            http = FakeHttp()
            client = MineruAgentClient(base_url="https://mineru.net/api/v1/agent", http=http)

            output_path = parse_pdf_to_sibling_markdown(pdf_path, client, poll_interval_seconds=0)

            self.assertEqual(output_path, pdf_path.resolve().with_suffix(".md"))
            self.assertEqual(output_path.read_text(encoding="utf-8"), "# Parsed paper\n")
            self.assertEqual(
                [call[0] for call in http.calls],
                ["POST", "PUT", "GET_JSON", "GET_TEXT"],
            )

    def test_urllib_upload_uses_empty_content_type_for_signed_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf_path = Path(tmp) / "paper.pdf"
            pdf_path.write_bytes(b"%PDF-1.7")
            captured = {}

            def fake_open(request):
                captured["content_type"] = request.get_header("Content-type")

                class FakeContext:
                    status = 200

                    def __enter__(self):
                        return self

                    def __exit__(self, exc_type, exc, tb):
                        return False

                    def read(self):
                        return b""

                return FakeContext()

            with patch("urllib.request.urlopen", fake_open):
                response = UrllibTransport().put_file("https://upload.example/paper.pdf", pdf_path)

            self.assertEqual(response, UrllibResponse(status_code=200, text=""))
            self.assertEqual(captured["content_type"], "")


if __name__ == "__main__":
    unittest.main()
