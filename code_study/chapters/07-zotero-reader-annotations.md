# 07. Zotero Reader Text Locations and Annotations

本章目标：理解段落翻译如何变成 Zotero 侧边栏里的灰色注释卡片。

## 1. 当前实现边界

已经实现：

- 段落翻译接口。
- 每个 text block 携带全文、章节、前后段上下文进入翻译 provider。
- 文本匹配算法：把段落文本匹配到 page text runs。
- annotation payload builder：生成 Zotero highlight JSON。
- runtime writer 窄接口：目标是 `Zotero.Annotations.saveFromJSON`。

尚未实现：

- live Zotero Reader text runs 抽取。
- 真实 Zotero 窗口中的菜单/命令触发。
- 真实 Zotero runtime 写入验证。

## 2. 翻译请求

文件：

```text
src/translate/provider.ts
src/translate/contextual-translator.ts
```

请求结构：

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

设计原因：

- 只翻译当前段落容易丢上下文。
- 加全文和前后段可以帮助翻译专业术语。
- provider 是接口，后续可接 OpenAI、本地模型或其他翻译服务。

## 3. Text location

文件：

```text
src/zotero/text-location.ts
```

核心输入：

```ts
interface ZoteroReaderPageText {
  pageIndex: number;
  pageLabel: string;
  runs: ZoteroReaderTextRun[];
}
```

每个 run 包含：

- 页面文本片段。
- 对应 PDF rects。

算法目标：

```text
source paragraph
  -> normalize whitespace
  -> search in joined page text
  -> map matched character range back to runs
  -> collect rects
```

## 4. Annotation payload

文件：

```text
src/zotero/annotations.ts
```

目标结构：

```ts
interface ZoteroTranslationAnnotationPayload {
  key: string;
  type: "highlight";
  text: string;
  comment: string;
  color: string;
  pageLabel: string;
  sortIndex: string;
  position: {
    pageIndex: number;
    rects: number[][];
  };
  tags: ZoteroAnnotationTag[];
}
```

本项目约定：

| 字段 | 约定 |
| --- | --- |
| `text` | 原文段落，显示在注释卡片上方。 |
| `comment` | 译文，显示在注释卡片下方。 |
| `color` | 灰色 `#aaaaaa`。 |
| `tags` | `mineru-translation`。 |
| `position.rects` | 由 text-location provider 提供。 |

## 5. 为什么用灰色注释

灰色表示机器生成的翻译卡片，与用户手工高亮区分：

```ts
export const GRAY_TRANSLATION_ANNOTATION_COLOR = "#aaaaaa";
```

这样用户可以在 Zotero Reader 里一眼区分：

- 手工阅读标注。
- 自动翻译注释。
- 后续 AI 摘要或解释注释。

## 6. 官方知识点

- Zotero annotations in database: <https://www.zotero.org/support/kb/annotations_in_database>
- Zotero JavaScript API notes: <https://www.zotero.org/support/dev/client_coding/javascript_api>
- Zotero source repository: <https://github.com/zotero/zotero>
- TypeScript object types: <https://www.typescriptlang.org/docs/handbook/2/objects.html>

## 7. 初学者练习

1. 打开 `tests/zotero/text-location.test.ts`，解释 fake page text runs 如何模拟 PDF 页面。
2. 打开 `tests/zotero/annotations.test.ts`，确认 `color` 和 `tags` 断言。
3. 写一个 fake `TranslationProvider`，把每段译文改成 `[ZH] ${text}`。
4. 把 fake provider 接入 `tests/zotero/mineru-workflow.test.ts`，观察 annotations 数量。

