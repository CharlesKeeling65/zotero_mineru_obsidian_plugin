# 05. MinerU API Workflow

本章目标：理解 Python 和 TypeScript 两套 MinerU 核心链路。

## 1. 为什么先写 Python 脚本

用户要求先基于 Python 完成核心工作流实现与调试，再转换成 JS/TS 集成到 Zotero 插件中。Python 脚本的价值：

- 最小依赖。
- 更容易直接试跑一个 PDF。
- 和插件工程解耦，便于排查 MinerU API 问题。

脚本位置：

```text
scripts/mineru_agent_parse.py
```

## 2. Python 核心流程

```text
parse_pdf_to_sibling_markdown(pdf_path)
  -> MineruAgentClient.parse_file
    -> _create_file_task
    -> _upload_file
    -> _poll_markdown_url
    -> _download_markdown
  -> write <same-folder>/<same-name>.md
```

命令：

```bash
python scripts/mineru_agent_parse.py "/absolute/path/to/paper.pdf"
```

输出：

```text
/absolute/path/to/paper.md
```

## 3. MinerU Agent API 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `base_url` | `https://mineru.net/api/v1/agent` | Agent API 基础地址。 |
| `language` | `ch` | 语言提示。 |
| `page_range` | `None` | 可选页码范围。 |
| `enable_table` | `True` | 请求表格解析。 |
| `is_ocr` | `False` | 默认不强制 OCR。 |
| `enable_formula` | `True` | 请求公式解析。 |
| `poll_interval_seconds` | `3` | 轮询间隔。 |
| `timeout_seconds` | `300` | 总超时。 |

官方文档：

- MinerU API: <https://mineru.net/apiManage/docs>
- Python `urllib.request`: <https://docs.python.org/3/library/urllib.request.html>
- Python `argparse`: <https://docs.python.org/3/library/argparse.html>
- Python `pathlib`: <https://docs.python.org/3/library/pathlib.html>

## 4. 签名上传 URL 的注意点

MinerU Agent API 创建任务后返回上传 URL。上传阶段不是普通 JSON API，而是 PUT 原始 PDF bytes。

脚本里有一个关键细节：

```py
headers={"Content-Type": ""}
```

这是为了避免预签名上传时签名和 header 不一致。TypeScript 版本也不主动设置 `Content-Type`。

## 5. TypeScript provider 对应关系

TypeScript 实现：

```text
src/mineru/provider-agent.ts
```

核心方法：

| Python | TypeScript |
| --- | --- |
| `MineruAgentClient.parse_file()` | `MineruAgentProvider.parsePdf()` |
| `_create_file_task()` | `createFileTask()` |
| `_upload_file()` | `uploadFile()` |
| `_poll_markdown_url()` | `pollForMarkdownUrl()` |
| `_download_markdown()` | `downloadMarkdown()` |
| `_read_api_json()` | `readJson()` |

TypeScript provider 返回：

```ts
interface ParsePdfOutput {
  document: RawMineruDocument;
  rawFiles: RawMineruFile[];
}
```

## 6. 为什么 provider 返回 rawFiles

解析结果不仅要进入 normalizer，还要保留原始产物：

- 方便人工检查 MinerU 输出。
- 方便未来 normalizer 升级后重放 raw data。
- 方便 debug 和版本管理。

这就是 `ParseService` 先 `cache.writeRawFile()` 再 normalize 的原因。

## 7. 官方知识点

- Fetch API: <https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API>
- Node.js fs promises: <https://nodejs.org/api/fs.html#promises-api>
- Python Protocol: <https://docs.python.org/3/library/typing.html#typing.Protocol>
- MinerU project repository: <https://github.com/opendatalab/MinerU>

## 8. 初学者练习

1. 在 Python 测试中模拟 MinerU 返回 `state == "failed"`，断言抛出 `MineruAgentError`。
2. 在 TypeScript 测试中模拟 poll 两次后完成，理解异步轮询测试。
3. 把 `poll_interval_seconds` 改成 `0.1` 试跑 fake test，不要对真实 API 过度频繁请求。
4. 解释为什么 API client 不应该直接写 Zotero annotation。

