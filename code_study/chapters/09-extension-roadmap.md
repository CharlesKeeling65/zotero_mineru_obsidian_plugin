# 09. Extension Roadmap

本章目标：说明初学者后续可以怎样安全扩展这个项目。

## 1. 当前完整到哪里

已经完成的核心基础：

- Python MinerU PDF -> sibling Markdown 调试链路。
- TypeScript MinerU Agent provider。
- Zotero PDF selection helper。
- Markdown fallback paragraph splitting。
- `Document/Block/Asset/Relation/AIAnnotation` 内部模型。
- deterministic block IDs。
- 段落级翻译接口。
- Zotero Reader text-location matching core。
- 灰色 translation annotation payload builder。
- 单元测试和构建脚本。

未完成的关键产品化部分：

- 真正可安装的 Zotero 插件打包。
- Zotero Reader 菜单/按钮触发 workflow。
- 从 live Zotero Reader 抽取 text runs/rects。
- 真实翻译 provider。
- 完整 vault export UI 和设置页。

## 2. 推荐扩展顺序

### Step 1: 实现真实 TranslationProvider

文件：

```text
src/translate/provider.ts
src/translate/contextual-translator.ts
```

建议：

- 先写 fake provider 测试。
- 再写真实 provider。
- 处理 API key、超时、失败重试。
- 不要把翻译结果写回 `Block.content.text`。

### Step 2: 接 Zotero Reader runtime text runs

文件：

```text
src/zotero/text-location.ts
```

建议：

- 保持当前 `ZoteroReaderTextLocationProvider` 接口。
- 新增一个 runtime adapter，从 live Reader 获取页面文本和 rects。
- adapter 层可以依赖 Zotero runtime，算法层不要依赖。

### Step 3: 接 Zotero annotation writer

文件：

```text
src/zotero/annotations.ts
```

建议：

- 继续使用 `TranslationAnnotationWriter`。
- runtime adapter 内部调用 `Zotero.Annotations.saveFromJSON`。
- 先在测试里验证 payload，再手动进 Zotero 验证显示效果。

### Step 4: 打包 Zotero plugin

文件：

```text
src/plugin/manifest.ts
src/plugin/bootstrap.ts
```

建议：

- 对照官方 sample plugin。
- 先实现最小菜单命令。
- 再接 settings UI。
- 不要一次性引入复杂前端框架。

官方文档：

- Zotero plugin development: <https://www.zotero.org/support/dev/client_coding/plugin_development>
- Official sample plugin: <https://github.com/zotero/make-it-red>

### Step 5: Vault export

目标结构：

```text
LiteratureVault/
  Papers/
    YEAR_Author_Title/
      paper.md
      full.md
      document.json
      metadata.json
      blocks/
      assets/
      ai/
```

建议：

- 先导出 `document.json` 和 `full.md`。
- 再导出 per-block markdown。
- 最后导出 assets 和 AI annotations。

## 3. 新功能开发模板

每次加功能前先回答：

| 问题 | 示例 |
| --- | --- |
| 它属于哪一层？ | translate / zotero / export / normalize |
| 输入是什么？ | `Block[]`, `Document`, PDF path |
| 输出是什么？ | annotation payload, vault files |
| 是否有外部副作用？ | HTTP、文件系统、Zotero DB |
| 如何用 fake object 测试？ | fake provider, fake writer |
| 失败怎么暴露？ | typed error, logger |

## 4. 不建议的扩展方式

- 不要在 UI 组件里直接调用 MinerU API。
- 不要把翻译结果覆盖原始 paragraph text。
- 不要把 Zotero runtime 对象传进 normalizer。
- 不要用数组 index 作为唯一 block identity。
- 不要在没有测试的情况下重写 Markdown splitter。

## 5. 官方知识点

- Zotero plugin development: <https://www.zotero.org/support/dev/client_coding/plugin_development>
- TypeScript TSConfig: <https://www.typescriptlang.org/tsconfig/>
- Vitest mocking: <https://vitest.dev/guide/mocking>
- Node.js fs promises: <https://nodejs.org/api/fs.html#promises-api>

