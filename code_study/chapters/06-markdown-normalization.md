# 06. Markdown Preprocessing and Normalization

本章目标：理解真实 MinerU Markdown 如何变成内部 `Document/Block`。

## 1. 为什么需要 Markdown preprocessing

当前 MinerU 快速响应 API 没有可靠 layout 坐标，也可能只返回完整 Markdown。为了继续打通核心工作流，项目实现了 fallback：

```text
full Markdown
  -> article body
  -> ordered paragraphs
  -> RawMineruBlock[]
  -> normalizeMineruDocument()
```

对应文件：

- `src/parse/markdown-preprocessor.ts`
- `src/normalize/normalizer.ts`
- `tests/parse/markdown-preprocessor.test.ts`
- `scripts/inspect_markdown_blocks.mjs`

## 2. 真实 Markdown 验证基准

当前测试使用真实 MinerU 生成的 Markdown：

```text
/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md
```

断言结果：

- 拆出 `102` 个有序 text blocks。
- `frontmatter`、`abstract`、`introduction`、`results`、`discussion`、`methods`、`availability` 等核心区段可识别。
- 没有把 `References` 文献列表当成正文 block。

## 3. 拆分规则

`markdownToTextBlocks()` 的主要规则：

| 规则 | 目的 |
| --- | --- |
| 找到独立 `Article` 行后开始 | 跳过封面或前置 metadata。 |
| Markdown heading 作为 section boundary | 建立 sectionPath。 |
| 空行切段 | 得到 paragraph-level blocks。 |
| 软换行合并 | 修复 PDF/Markdown 的换行噪音。 |
| 跳过纯 Markdown table | 避免表格误判为正文段落。 |
| 遇到 references-like section 停止 | 避免 bibliography 污染正文。 |
| 对无显式标题的摘要/引言做推断 | 兼容 Nature 风格文章。 |

## 4. CoreSection 推断

核心枚举：

```ts
type CoreSection =
  | "frontmatter"
  | "abstract"
  | "introduction"
  | "results"
  | "results_discussion"
  | "discussion"
  | "methods"
  | "availability"
  | "other";
```

为什么需要 `CoreSection`：

- UI 可以按文章结构过滤。
- 翻译 provider 可以拿到章节上下文。
- 未来 AI workflow 可以按摘要/方法/结果分别处理。

## 5. Normalizer 做什么

`normalizeMineruDocument()` 把 raw blocks 转成内部结构：

```text
RawMineruDocument
  -> Document
  -> Block[]
  -> Asset[]
  -> Relation[]
  -> AIAnnotation[]
```

当前重点：

- 生成 deterministic block ID。
- 保留显式 `order`。
- 生成 section tree。
- 生成相邻 block 的顺序关系。
- 记录 schema version。

## 6. 如何人工查看拆分结果

```bash
npm run build
npm run inspect:markdown-blocks -- "/absolute/path/to/paper.md" 8
```

输出包括：

- `blockCount`
- 前 N 个 blocks
- 最后 3 个 blocks

这样你可以直接检查段落边界、sectionPath 和 coreSection 是否合理。

## 7. 官方知识点

- JavaScript regular expressions: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions>
- JavaScript arrays: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array>
- Node.js path API: <https://nodejs.org/api/path.html>
- TypeScript literal types: <https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types>

## 8. 初学者练习

1. 用 `inspect:markdown-blocks` 打印前 12 个 block。
2. 找到第一个 `abstract` block，解释它为什么不是 heading。
3. 修改测试，断言第 14 个 block 的 `coreSection` 是 `results`。
4. 添加一个新的 references-like stop heading，比如 `Ethics declarations`，并补测试。

