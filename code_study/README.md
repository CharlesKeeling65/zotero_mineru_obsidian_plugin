# Code Study: 从零学习这个 Zotero + MinerU + TypeScript 项目

这个目录把当前仓库整理成一个教学示范项目。目标读者是刚开始接触 Zotero 插件、TypeScript 工程、API 客户端、分层架构和自动化测试的开发者。

学习方式不是先背框架概念，而是沿着真实功能链路学习：

```text
选中 Zotero PDF
  -> 调用 MinerU Agent API
  -> 保存同级 Markdown
  -> Markdown 文章/段落拆分
  -> 标准化 Document/Block 模型
  -> 段落级翻译接口
  -> Zotero Reader 文本定位
  -> 灰色翻译注释 payload
```

## 推荐学习顺序

| 顺序 | 文件 | 学习目标 |
| --- | --- | --- |
| 1 | [00-learning-map.md](./chapters/00-learning-map.md) | 了解全局学习路线、每天做什么、如何验收。 |
| 2 | [01-environment-and-repo.md](./chapters/01-environment-and-repo.md) | 安装依赖、运行测试、理解仓库目录。 |
| 3 | [02-typescript-project-basics.md](./chapters/02-typescript-project-basics.md) | 学 TypeScript、ESM、tsconfig、接口和依赖注入。 |
| 4 | [03-zotero-plugin-basics.md](./chapters/03-zotero-plugin-basics.md) | 学 Zotero 插件结构、manifest/bootstrap、Reader/annotation 背景。 |
| 5 | [04-core-architecture.md](./chapters/04-core-architecture.md) | 学本项目分层架构和核心数据流。 |
| 6 | [05-mineru-api-workflow.md](./chapters/05-mineru-api-workflow.md) | 学 Python 与 TypeScript 两套 MinerU 调用链路。 |
| 7 | [06-markdown-normalization.md](./chapters/06-markdown-normalization.md) | 学真实 MinerU Markdown 如何拆成 102 个有序 text blocks。 |
| 8 | [07-zotero-reader-annotations.md](./chapters/07-zotero-reader-annotations.md) | 学翻译、PDF rect 匹配、Zotero 注释 payload。 |
| 9 | [08-testing-debugging.md](./chapters/08-testing-debugging.md) | 学 Vitest、Python unittest、测试替身和调试脚本。 |
| 10 | [09-extension-roadmap.md](./chapters/09-extension-roadmap.md) | 学后续如何扩展 UI、真实 Zotero runtime、翻译 provider 和 vault export。 |

## 快速开始

```bash
npm install
npm test
npm run check
npm run build
python -m unittest tests/python/test_mineru_agent_parse.py
```

如果你已经有 MinerU 生成的真实 Markdown，可以运行：

```bash
npm run build
npm run inspect:markdown-blocks -- "/absolute/path/to/paper.md" 8
```

## 读代码时优先打开的文件

| 目的 | 文件 |
| --- | --- |
| 看公共导出入口 | `src/main.ts` |
| 看插件元数据和启动边界 | `src/plugin/manifest.ts`, `src/plugin/bootstrap.ts` |
| 看 MinerU API 调用 | `src/mineru/provider-agent.ts`, `scripts/mineru_agent_parse.py` |
| 看核心编排 | `src/parse/parse-service.ts`, `src/zotero/mineru-workflow.ts` |
| 看 Markdown 拆段 | `src/parse/markdown-preprocessor.ts` |
| 看内部模型 | `src/model/*.ts` |
| 看标准化 | `src/normalize/normalizer.ts` |
| 看翻译接口 | `src/translate/provider.ts`, `src/translate/contextual-translator.ts` |
| 看 Zotero 注释 payload | `src/zotero/text-location.ts`, `src/zotero/annotations.ts` |
| 看测试写法 | `tests/**/*.test.ts`, `tests/python/test_mineru_agent_parse.py` |

## 官方文档入口

完整链接列表集中在 [official-docs.md](./official-docs.md)。每个章节也会在对应知识点旁边标出官方文档入口。

## 学习原则

- 先跑测试，再读实现。测试会告诉你功能边界。
- 先读接口，再读具体实现。接口是架构意图。
- 先理解数据流，再理解工具链。工具只是让数据流可验证。
- 先改测试中的 fake provider，再改真实 API provider。这样风险最低。
- 不要直接把 MinerU raw 输出当 UI 模型。这个项目的核心价值是标准化结构。

