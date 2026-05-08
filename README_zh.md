# 结构化文献工作区

这是一个面向 Zotero 8/9 的插件工程基线，用 MinerU 将选中的论文 PDF 转换成段落级结构化文献工作区，并以 Zotero 作为阅读与注释入口。

本项目不是通用 PDF 转 Markdown 工具。它的目标是为学术论文建立 block-level 阅读、翻译、导出和未来 AI 深度理解的基础设施。

## 当前状态

已经实现：

- Python 版 MinerU Agent API 调试流程：创建任务、上传 PDF、轮询结果、下载 Markdown，并以 PDF 同名 `.md` 保存到同一父文件夹。
- TypeScript 版 MinerU Agent provider：创建任务、签名 URL 上传、轮询、下载 Markdown、持久化 raw files，并保留 provider 抽象以支持后续后端。
- Zotero PDF 选择辅助函数，以及把 MinerU 输出保存到选中 attachment PDF 同级目录的 workflow。
- Markdown 预处理 fallback：当 MinerU 没有返回 layout blocks 时，把 MinerU `Article` Markdown 正文拆成有序 paragraph `text` blocks。
- 归一化内部模型：`Document`、`Block`、`Asset`、`Relation`、`AIAnnotation`。
- 基于稳定输入的 deterministic block ID，同时保留显式 `order` 字段。
- 上下文段落翻译接口：翻译请求包含全文、章节路径、前一段和后一段。
- Zotero Reader text-location 匹配核心：可以把段落文本匹配到页面 text runs，并生成 `position.rects`。
- Zotero 灰色翻译注释 payload 构建：高亮引用部分是原段落，注释 comment 是译文；如果已经解析到 reader rects，则会写入 annotation position。
- 插件 manifest/bootstrap 模块，以及轻量 logger/error primitives。
- 单元测试覆盖 parse、normalize、bootstrap、errors、markdown 拆分、上下文翻译、Zotero annotation payload 和 MinerU workflow 集成。

尚未实现：

- 可打包的 Zotero UI/menu command，尚不能直接从 Zotero Reader 内完整触发工作流。
- 从 live Zotero Reader instance 中提取每页 text runs 的 runtime 宿主绑定。
- 在真实 Zotero 窗口内创建页面锚定 highlight。当前 payload 已可携带 rects，但 live runtime creation 还需要宿主层接入。
- 真实翻译 API provider。当前翻译层是接口和 workflow 接入点。
- 完整 vault export。当前主要是 raw Markdown/JSON 基线。
- API key、vault 路径、翻译 provider 和 workflow 选项的设置页 UI。

## 工作流

```text
选中的 Zotero PDF
  -> MinerU Agent 解析
  -> PDF 同级 Markdown 输出
  -> Markdown Article 预处理
  -> 有序 paragraph RawMineruBlock[]
  -> 归一化 Document/Block 模型
  -> 上下文段落翻译 provider
  -> Zotero Reader text-location provider
  -> 段落 PDF rects
  -> 灰色 Zotero 翻译注释 payload
  -> 后续 Zotero.Annotations.saveFromJSON runtime 写入
```

## 核心模块

| 区域 | 文件 | 职责 |
| --- | --- | --- |
| Python MinerU 调试流程 | `scripts/mineru_agent_parse.py` | 用 MinerU Agent API 解析一个本地 PDF，并写出同级 `.md`。 |
| TypeScript MinerU provider | `src/mineru/provider-agent.ts` | 创建 MinerU Agent 任务、上传 PDF、轮询状态、下载 Markdown。 |
| Parse 编排 | `src/parse/parse-service.ts` | 运行 provider、持久化 raw files、执行 Markdown fallback 预处理、归一化输出。 |
| Markdown 预处理 | `src/parse/markdown-preprocessor.ts` | 提取 `Article` 正文，遇到 references-like 章节停止，跳过 Markdown 表格，输出有序段落 text blocks。 |
| 内部模型 | `src/model/` | 定义 document、block、asset、relation、annotation 和 schema-version 类型。 |
| 归一化 | `src/normalize/normalizer.ts` | 将 MinerU 形态数据转换为内部 schema，生成 deterministic block IDs 和 section tree。 |
| 翻译接口 | `src/translate/provider.ts` | 定义 `translateParagraph(request)`。 |
| 翻译编排 | `src/translate/contextual-translator.ts` | 对每个 text block 携带全文和相邻段落上下文调用翻译 provider。 |
| Zotero text locations | `src/zotero/text-location.ts` | 将原文段落匹配到 Zotero Reader 页面 text runs，并返回页面矩形坐标。 |
| Zotero 注释 | `src/zotero/annotations.ts` | 构建灰色 highlight annotation payload，并封装 `Zotero.Annotations.saveFromJSON` 写入适配器。 |
| Zotero workflow | `src/zotero/mineru-workflow.ts` | 解析选中 PDF、运行 MinerU、写同级文件，可选执行翻译、解析 text locations 并创建注释。 |
| Markdown 检查脚本 | `scripts/inspect_markdown_blocks.mjs` | `npm run build` 后打印真实 Markdown 的段落拆分结果。 |
| 公共导出 | `src/main.ts` | 导出 plugin、MinerU、预处理、翻译和 annotation API。 |

## MinerU Agent 参数

Python 调试脚本：`scripts/mineru_agent_parse.py`

| 参数 | 位置 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `pdf_path` | CLI 位置参数 | 必填 | 需要解析的本地 PDF。 |
| `--base-url` | CLI 参数 | `https://mineru.net/api/v1/agent` | MinerU Agent API base URL。 |
| `--poll-interval` | CLI 参数 | `3` 秒 | 任务状态轮询间隔。 |
| `--timeout` | CLI 参数 | `300` 秒 | 等待任务完成的最大时间。 |
| `language` | `MineruAgentClient.parse_file()` | `ch` | MinerU 语言提示。 |
| `enable_table` | `MineruAgentClient.parse_file()` | `true` | 是否请求表格解析。 |
| `is_ocr` | `MineruAgentClient.parse_file()` | `false` | OCR 模式开关。 |
| `enable_formula` | `MineruAgentClient.parse_file()` | `true` | 是否请求公式解析。 |
| `page_range` | `MineruAgentClient.parse_file()` | 未设置 | 可选页码范围。 |

TypeScript provider：`src/mineru/provider-agent.ts`

| 参数 | 位置 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `baseUrl` | `MineruAgentConfig` | 调用方必传 | MinerU Agent API base URL。 |
| `apiKey` | `MineruAgentConfig` | 可选 | JSON API 请求中作为 `Authorization: Bearer <apiKey>` 发送。 |
| `timeoutMs` | `MineruAgentConfig` | `300000` | 状态轮询最大持续时间。 |
| `pollIntervalMs` | `MineruAgentConfig` | `3000` | 状态轮询间隔。 |
| `file_name` | create-task request body | PDF 文件名 | MinerU 上传文件名。 |
| `language` | create-task request body | `ch` | MinerU 语言提示。 |
| `enable_table` | create-task request body | `true` | 表格解析开关。 |
| `is_ocr` | create-task request body | `false` | OCR 解析开关。 |
| `enable_formula` | create-task request body | `true` | 公式解析开关。 |

重要上传细节：签名上传 URL 不能随意附带非空 `Content-Type`。Python transport 显式发送空 `Content-Type`，避免 OSS `SignatureDoesNotMatch`；TypeScript `fetch` 上传不设置 `Content-Type`。

## Markdown 段落拆分

当 MinerU 只返回 Markdown 时，`ensureMarkdownTextBlocks()` 会在 normalizer 前创建 fallback text blocks。

当前 `src/parse/markdown-preprocessor.ts` 实现的规则：

- 如果存在单独一行 `Article`，从其后开始处理。
- Markdown heading 作为 section 边界。
- 遇到 `References`、`Bibliography`、`Acknowledgments`、`Author Contributions`、`Competing Interests`、`Supplementary` 等末尾章节时停止。
- 空行切分段落。
- 同一段落内的软换行会合并为空格。
- 纯 Markdown 表格段落会跳过。
- fallback `pageStart` 和 `pageEnd` 设为 `1`，因为 MinerU 快速 Agent Markdown 不包含 layout 坐标。
- 显式顺序字段为 `order: 1..n`。

### 如何用真实 MinerU Markdown 验证拆分

拆分行为现在直接用这次 MinerU 真实生成的 Markdown 验证：

```text
/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md
```

测试文件是 `tests/parse/markdown-preprocessor.test.ts`。它默认读取上述真实 Markdown 路径；也可以通过 `REAL_MINERU_MARKDOWN_PATH` 环境变量覆盖输入文件。

```bash
npm test -- tests/parse/markdown-preprocessor.test.ts
```

当前对这个真实 Markdown 的断言：

- 该 Markdown 会拆成 `102` 个有序 text blocks。
- 第 `1` 个 block 是 `coreSection: "frontmatter"`，位于论文标题 section，并包含 received date。
- 第 `6` 个 block 是 `coreSection: "abstract"`，包含推断出的摘要开头段落。
- 第 `7` 个 block 开始进入推断出的 `coreSection: "introduction"`，因为这类 Nature Markdown 没有显式 Introduction heading。
- 第 `14` 个 block 是 `coreSection: "results"`，位于 `Divergent estimates in evaluating manure recycling` section。
- 至少存在一个 `coreSection: "discussion"` block，且至少存在一个 `coreSection: "methods"` block。
- 最后一个 block 是 `coreSection: "availability"`，位于 `Code availability` section。
- 不会生成 `References` section 下的 block。

如果你不想只看测试 pass/fail，而是要直接审阅拆分结果，先 build，然后运行：

```bash
npm run build
npm run inspect:markdown-blocks -- "/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md" 8
```

该命令会输出 JSON，包含 `blockCount`、前 N 个 blocks 和最后 3 个 blocks，可以直接人工检查段落边界和 section 归属。

## 翻译与 Zotero 注释 payload

翻译请求结构：`src/translate/provider.ts`

```ts
interface ParagraphTranslationRequest {
  text: string;
  fullDocumentMarkdown: string;
  documentTitle: string;
  sectionPath: string[];
  previousParagraph: string | null;
  nextParagraph: string | null;
  order: number;
}
```

注释 payload 结构：`src/zotero/annotations.ts`

```ts
interface ZoteroTranslationAnnotationPayload {
  key: string;
  type: "highlight";
  text: string;
  comment: string;
  color: "#aaaaaa";
  pageLabel: string;
  sortIndex: string;
  position: {
    pageIndex: number;
    rects: number[][];
  };
  tags: [{ name: "mineru-translation" }];
}
```

当前行为：

- `text` 是原文段落，对应 Zotero 注释卡片上方的引用文本。
- `comment` 是译文，对应 Zotero 注释卡片下方的注释内容。
- `color` 统一为灰色：`#aaaaaa`。
- `tags` 包含 `mineru-translation`。
- 当 `textLocationProvider` 能够把原文段落匹配到 Zotero Reader 页面 text runs 时，`position.rects` 会被填充。
- 只有未提供 text-location provider 或没有匹配结果时，`position.rects` 才保持为空。

Zotero 参考背景：

- Zotero PDF Reader 注释存储在 Zotero 数据库中：<https://www.zotero.org/support/kb/annotations_in_database>
- Zotero 本地 JavaScript API 文档有限，经常需要查源码：<https://www.zotero.org/support/dev/client_coding/javascript_api>
- 当前 runtime 写入适配器目标是 `Zotero.Annotations.saveFromJSON`。

## 本地 MinerU 调试命令

```bash
python scripts/mineru_agent_parse.py "/absolute/path/to/paper.pdf"
```

预期结果：

- 创建 `/absolute/path/to/paper.md`。
- Markdown 输出与 PDF 位于同一父文件夹。
- 输出文件名与 PDF base name 保持一致。

该 live debug flow 已经用真实 PDF 跑通过并产生同级 Markdown。网络访问和 MinerU 账号/API 可用性属于外部条件。

## 测试与构建

```bash
npm test
npm run check
npm run build
npm run inspect:markdown-blocks -- "/absolute/path/to/paper.md" 8
python -m unittest tests/python/test_mineru_agent_parse.py
```

当前验证基线：

- `npm test`：运行 TypeScript parse/normalize/Zotero/translation 单元测试。
- `npm run check`：TypeScript 类型检查。
- `npm run build`：将 `src/` 编译到 `dist/`。
- `npm run inspect:markdown-blocks -- <markdown> <count>`：打印真实 Markdown 的 block 拆分结果，供人工审阅。
- Python 单元测试覆盖本地 MinerU debug client 和签名上传 header 行为。

## 仓库结构

```text
src/
  ai/
  export/
  main.ts
  mineru/
  model/
  normalize/
  parse/
  plugin/
  prefs/
  translate/
  types/
  ui/
  utils/
  zotero/
scripts/
tests/
docs/plans/
```

## Zotero 兼容性基线

本仓库以 Zotero 8 为最低目标，并保持 Zotero 9 前向兼容。新增代码应避免 Zotero 7-only 假设，除非该逻辑被隔离在 adapter 内。

对于 annotation anchoring，下一步技术重点是 Zotero runtime 宿主绑定：从 live Reader instance 提取页面 text runs 和 rectangles，传入 `ZoteroReaderTextLocationProvider`，再用生成的 payload 调用 `Zotero.Annotations.saveFromJSON`。

## 路线图

1. 增加真实 Zotero runtime command/menu entry，让用户能从选中的 PDF attachment 触发 MinerU workflow。
2. 将 text-location provider 绑定到 live Zotero Reader runtime，让页面 text runs 和 rectangles 来自当前 PDF。
3. 增加真实翻译 provider 实现，以及凭据和模型选择设置。
4. 将 normalized documents 和 translation annotation metadata 持久化到 PDF 同级目录或配置的 vault。
5. 扩展 vault export，支持 `paper.md`、`full.md`、`document.json`、`metadata.json`、per-block files、assets 和 AI outputs。
6. 增加最小 Zotero panel，提供 Outline、Cards、Visuals 和 Export 视图。

## 规范计划文档

- Master plan：`docs/plans/2026-04-23-master-implementation-plan.md`
- Initial scaffold plan：`docs/plans/2026-04-23-zotero-structured-literature-workspace.md`
