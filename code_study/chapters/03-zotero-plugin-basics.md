# 03. Zotero Plugin Basics

本章目标：理解这个项目如何逐步成为标准 Zotero 插件。

## 1. Zotero 插件是什么

Zotero 插件运行在 Zotero 客户端内部，可以访问 Zotero 的条目、附件、Reader 和部分本地 JavaScript API。

官方入口：

- Zotero plugin development: <https://www.zotero.org/support/dev/client_coding/plugin_development>
- Zotero JavaScript API notes: <https://www.zotero.org/support/dev/client_coding/javascript_api>
- Official sample plugin: <https://github.com/zotero/make-it-red>

## 2. 本项目的插件边界

当前插件相关文件：

| 文件 | 作用 |
| --- | --- |
| `src/plugin/manifest.ts` | 插件元数据的 canonical source。 |
| `src/plugin/bootstrap.ts` | 插件启动/关闭生命周期函数。 |
| `src/main.ts` | 对外导出入口。 |
| `src/zotero/selection.ts` | 从 Zotero 当前选择解析 PDF attachment。 |
| `src/zotero/mineru-workflow.ts` | Zotero PDF -> MinerU -> annotation 的应用编排。 |

## 3. manifest 和 bootstrap

标准插件通常需要声明：

- 插件 ID
- 名称
- 版本
- 兼容 Zotero 版本
- 启动入口

本项目把这些元数据放进 `src/plugin/manifest.ts`，避免在多个文件里重复写版本和兼容信息。

`bootstrap.ts` 负责生命周期概念：

```text
startup
shutdown
install
uninstall
```

后续真实 Zotero 打包时，需要把这些 TypeScript 产物接到 Zotero 认可的插件文件结构中。

## 4. Zotero 8/9 兼容思路

README 中明确：本项目以 Zotero 8 为基线，并尽量保持 Zotero 9 前向兼容。开发时要避免：

- 把 Zotero 7-only API 写死在业务层。
- 在 parse/normalize 层直接引用 Zotero 全局对象。
- 把 Reader runtime 细节扩散到所有模块。

正确做法：

```text
Zotero runtime detail
  -> adapter/narrow interface
  -> workflow
  -> parse/normalize pure logic
```

官方背景：

- Zotero 7 for developers: <https://www.zotero.org/support/dev/zotero_7_for_developers>

## 5. Reader annotation 背景

本项目的目标之一是把翻译结果显示在 Zotero 自带侧边注释栏。对应模块：

- `src/zotero/text-location.ts`: 找 PDF 页面 rects。
- `src/zotero/annotations.ts`: 构造灰色 highlight annotation payload。

重要概念：

| 概念 | 含义 |
| --- | --- |
| `text` | 注释卡片上方的原文引用。 |
| `comment` | 注释卡片下方的译文。 |
| `color` | 灰色 `#aaaaaa`，区分机器翻译注释。 |
| `position.rects` | PDF 页面中的高亮矩形。 |
| `saveFromJSON` | 目标 Zotero runtime 写入方法。 |

官方背景：

- Annotations in Zotero database: <https://www.zotero.org/support/kb/annotations_in_database>

## 6. 还没完成的 Zotero runtime 工作

当前代码已经能构造 annotation payload，但还缺：

- 在真实 Zotero 窗口里添加菜单/命令。
- 从 live Reader 提取 page text runs 和 rects。
- 在真实 attachment 上调用 `Zotero.Annotations.saveFromJSON`。
- 打包成可安装插件。

这些缺口刻意保留在 Zotero adapter 层，而不是污染 parse/normalize 层。

## 7. 初学者练习

1. 打开 `src/plugin/manifest.ts`，找出插件 ID、名称、版本和兼容范围。
2. 打开 `tests/plugin/bootstrap.test.ts`，看 bootstrap 的测试如何验证生命周期。
3. 打开 `src/zotero/annotations.ts`，解释为什么使用 `ZoteroAnnotationsRuntime` 这种窄接口。
4. 阅读官方 sample plugin 的目录结构，对比本项目还缺哪些打包文件。

