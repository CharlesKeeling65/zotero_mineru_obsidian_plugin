# 04. Core Architecture

本章目标：理解项目为什么分层，以及每层之间如何协作。

## 1. 总体架构

```text
Zotero integration layer
  -> Parse application layer
  -> MinerU provider layer
  -> Markdown preprocessing
  -> Normalization/model layer
  -> Translation extension layer
  -> Zotero annotation adapter
  -> Export/AI future layers
```

对应目录：

| 层 | 目录 |
| --- | --- |
| Zotero integration | `src/zotero/` |
| MinerU API | `src/mineru/` |
| Parse orchestration | `src/parse/` |
| Model | `src/model/` |
| Normalization | `src/normalize/` |
| Translation | `src/translate/` |
| Export | `src/export/` |
| AI | `src/ai/` |

## 2. 为什么不能写成一个大函数

一个大函数可能长这样：

```text
read Zotero selection
  -> call MinerU
  -> write files
  -> split markdown
  -> translate
  -> create annotations
```

这样的问题：

- 无法单独测试 MinerU API。
- 无法单独测试 Markdown 拆分。
- 无法替换翻译 provider。
- Zotero runtime API 会污染所有代码。
- 后续 vault export 和 AI workflow 会越来越难加。

本项目采用接口边界：

| 接口 | 文件 | 作用 |
| --- | --- | --- |
| `MineruProvider` | `src/mineru/client.ts` | 屏蔽 MinerU 后端差异。 |
| `ParseCache` | `src/parse/parse-cache.ts` | 屏蔽 raw 文件保存位置。 |
| `TranslationProvider` | `src/translate/provider.ts` | 屏蔽具体翻译服务。 |
| `ZoteroReaderTextLocationProvider` | `src/zotero/text-location.ts` | 屏蔽 Zotero Reader runtime。 |
| `TranslationAnnotationWriter` | `src/zotero/annotations.ts` | 屏蔽 Zotero 注释写入 runtime。 |

## 3. 核心应用服务

`src/parse/parse-service.ts` 是核心 use case：

```text
provider.parsePdf(input)
  -> cache.writeRawFile(...)
  -> ensureMarkdownTextBlocks(...)
  -> normalizeMineruDocument(...)
```

它的职责是编排，不是实现所有细节。

`src/zotero/mineru-workflow.ts` 是 Zotero 场景下的更高层 use case：

```text
resolvePdfSelection
  -> ParseService.parse
  -> translateDocumentTextBlocks
  -> resolveTextLocationsForTranslations
  -> buildTranslationAnnotationPayloads
  -> annotationWriter.createTranslationAnnotations
```

## 4. 数据模型

核心模型在 `src/model/`：

| 模型 | 作用 |
| --- | --- |
| `Document` | 一篇结构化论文的顶层聚合。 |
| `Block` | 段落、图、表、公式等最小语义单元。 |
| `Asset` | 文件资源，例如图片、表格、公式文件。 |
| `Relation` | block 之间的关系。 |
| `AIAnnotation` | AI 派生内容，不能覆盖 raw block。 |

关键原则：

```text
raw parsed data
human notes
AI annotations
```

三者必须分离。

## 5. 稳定 ID 和 order

`src/normalize/normalizer.ts` 会生成 deterministic block IDs。设计目标：

- 同一篇文档、同一段结构输入，重复 normalization 得到相同 block ID。
- `order` 仍然保留为一等字段，用于 UI 顺序和导出顺序。

这比 `docId:type:order` 更稳定，因为 order 只是排序信息，不应该是唯一身份的全部来源。

## 6. 官方知识点

- TypeScript interfaces: <https://www.typescriptlang.org/docs/handbook/2/objects.html>
- TypeScript modules: <https://www.typescriptlang.org/docs/handbook/2/modules.html>
- Node.js path API: <https://nodejs.org/api/path.html>
- Node.js fs promises: <https://nodejs.org/api/fs.html#promises-api>

## 7. 初学者练习

1. 画出 `parseSelectedPdfWithMineru()` 的调用链。
2. 找出哪些函数是 pure function，哪些函数有 I/O side effect。
3. 给 `ParseCache` 写一个 memory implementation，并在测试里使用。
4. 回答：为什么 `normalizeMineruDocument()` 不应该直接调用 Zotero API？

