# 结构化文献工作区

这是一个面向 Zotero 8/9 的插件脚手架，目标是通过 MinerU 将 Zotero 中的论文 PDF 转换为结构化文献工作区。

## 范围

本仓库当前是工程基线。它的目标不是做通用 PDF 转 Markdown 工具，而是把 Zotero 论文从单个扁平 PDF 附件升级为后续可以支持以下能力的结构化对象：

- 按章节阅读
- 浏览图、表格和公式
- 导出到本地 vault，服务于 Obsidian 风格工作流
- 为 AI 辅助论文理解留下扩展点

当前重点是架构和核心原语，还不是完整可用的 Zotero UI。

## 当前状态

已经实现的内容：

- TypeScript 工作区和测试
- 与结构化文献产品定义一致的 `AGENTS.md`
- 类型化核心模型：`Document`、`Block`、`Asset`、`Relation`、`AIAnnotation`
- MinerU provider 抽象，以及 Agent 和 Standard 后端占位
- 解析编排服务
- 将 MinerU 形态原始数据归一化为内部模型的 pipeline
- Zotero PDF 选择辅助函数
- 面向 Zotero 8/9 的最小插件 manifest/bootstrap
- vault 导出占位
- AI provider 接口占位

尚未实现的内容：

- 真实 Zotero 宿主集成
- 真实 MinerU HTTP 上传和轮询
- Zotero 内部面板渲染
- 设置页 UI
- 按 block 导出到 vault
- AI 执行

## 规范计划文档

- Master plan: [docs/plans/2026-04-23-master-implementation-plan.md](/Users/wyb/File/Programming/Git_Code/zotero_mineru_obsidian_plugin/docs/plans/2026-04-23-master-implementation-plan.md)
- Initial scaffold plan: [docs/plans/2026-04-23-zotero-structured-literature-workspace.md](/Users/wyb/File/Programming/Git_Code/zotero_mineru_obsidian_plugin/docs/plans/2026-04-23-zotero-structured-literature-workspace.md)

后续 coding agent 应将 master plan 视为项目级范围、执行顺序和架构约束的事实来源。

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
  prefs/
  types/
  ui/
  zotero/
tests/
docs/plans/
```

## 脚本

- `npm test`：运行单元测试
- `npm run check`：运行 TypeScript 类型检查
- `npm run build`：将 `src/` 编译到 `dist/`

## Zotero 兼容性基线

本脚手架以 Zotero 8 为最低目标，并将 Zotero 9 作为前向兼容基线。新增代码应避免依赖 Zotero 7 专属 API，除非该依赖被明确隔离在兼容适配层中。

## 下一轮推荐工作

1. 将 MinerU provider 占位实现替换为真实任务创建、上传、轮询和结果下载。
2. 围绕纯 selection helper 增加真正的 Zotero runtime adapter。
3. 引入最小 panel shell，用归一化数据渲染 outline 和 block cards。
4. 将 vault 导出从 `full.md` 和 `document.json` 扩展到按 block markdown 和 assets 导出。
