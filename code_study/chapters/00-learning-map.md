# 00. Learning Map

本章回答三个问题：

- 这个项目到底在解决什么问题？
- 初学者应该按什么顺序学习？
- 每一步如何判断自己真的学会了？

## 1. 项目目标

这个仓库不是普通的 PDF 转 Markdown 脚本，而是 Zotero 插件的 MVP 基线。它把论文从“一个 PDF 附件”升级为“有结构的文献工作区”。

核心对象是 block：

```text
PDF paper
  -> Markdown
  -> Document
  -> Block[]
  -> Translation/Annotation/Export/AI extension
```

你要重点理解这条原则：

```text
MinerU raw output != UI model
```

MinerU 输出必须先进入 `src/parse/` 和 `src/normalize/`，转换成内部结构，后续 Zotero UI、导出、翻译和 AI 才能使用。

## 2. 建议 7 天学习计划

| 天数 | 学习内容 | 产出 |
| --- | --- | --- |
| Day 1 | 跑通测试和构建，熟悉目录 | 能解释 `npm test/check/build` 分别做什么。 |
| Day 2 | TypeScript 基础和模型接口 | 能解释 `Document`、`Block`、`Asset`、`Relation`。 |
| Day 3 | MinerU Python 调试脚本 | 能说出 create/upload/poll/download 四步。 |
| Day 4 | TypeScript MinerU provider | 能把 Python 流程对应到 `src/mineru/provider-agent.ts`。 |
| Day 5 | Markdown 拆分和 normalizer | 能解释为什么真实 Markdown 会拆出 102 个 text blocks。 |
| Day 6 | Zotero selection/text-location/annotation | 能解释灰色翻译卡片 payload 如何生成。 |
| Day 7 | 写一个小扩展 | 例如 fake translation provider 或新的 block filter。 |

## 3. 学习验收标准

完成本目录学习后，你应该能做到：

- 从零安装依赖并运行全部测试。
- 画出项目核心数据流。
- 解释为什么要使用 provider/cache/writer 这类接口。
- 看懂 `ParseService.parse()` 的职责边界。
- 看懂 `parseSelectedPdfWithMineru()` 的端到端编排。
- 修改一个测试，增加一个小功能，并确保 `npm test` 通过。

## 4. 核心概念词典

| 词 | 在本项目中的含义 |
| --- | --- |
| Provider | 对外部服务的适配器，例如 MinerU API 或翻译 API。 |
| Cache | 保存 raw 文件的接口，例如把 MinerU markdown 写到 PDF 同级目录。 |
| Normalization | 把 MinerU raw data 转成内部 `Document/Block` 模型。 |
| Block | 一段正文、一个图、一个表或一个公式，是最小阅读单元。 |
| Text location | 把段落文本匹配到 Zotero Reader 页面上的矩形坐标。 |
| Annotation payload | 准备交给 Zotero runtime 写入数据库的注释对象。 |
| Narrow interface | 只声明当前模块真正需要的方法，降低耦合。 |

## 5. 对应官方文档

- Zotero plugin development: <https://www.zotero.org/support/dev/client_coding/plugin_development>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/handbook/intro.html>
- MinerU API documentation: <https://mineru.net/apiManage/docs>
- Vitest guide: <https://vitest.dev/guide/>

