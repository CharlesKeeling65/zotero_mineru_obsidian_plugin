# Exercises

这些练习按风险从低到高排列。每完成一个练习，都运行：

```bash
npm test
npm run check
npm run build
```

如果修改了 Python 脚本，也运行：

```bash
python -m unittest tests/python/test_mineru_agent_parse.py
```

## Exercise 1: 读懂模型

目标：理解 `src/model/`。

步骤：

1. 打开 `src/model/block.ts`。
2. 写下 `blockId`、`order`、`coreSection` 的区别。
3. 打开 `src/model/document.ts`。
4. 解释 `sectionTree` 和 `stats` 为什么放在 Document 上。

验收：

- 能口头解释 `Document` 和 `Block` 的关系。

## Exercise 2: 写一个 fake translation provider

目标：理解 provider 接口。

步骤：

1. 在测试文件里创建一个对象，实现 `TranslationProvider`。
2. 让 `translateParagraph()` 返回 `ZH: ${request.text}`。
3. 调用 `translateDocumentTextBlocks()`。
4. 断言返回数量等于 text block 数量。

验收：

- `npm test` 通过。

## Exercise 3: 修改 Markdown stop section

目标：理解 markdown preprocessing。

步骤：

1. 打开 `src/parse/markdown-preprocessor.ts`。
2. 增加一个 terminal heading，例如 `Ethics declarations`。
3. 在 `tests/parse/markdown-preprocessor.test.ts` 加一个小样例。
4. 运行测试。

验收：

- 新增测试能证明该 section 后的段落不会变成 block。

## Exercise 4: 增加 annotation tag

目标：理解 annotation payload builder。

步骤：

1. 打开 `src/zotero/annotations.ts`。
2. 新增一个 tag，例如 `mineru-auto`。
3. 更新 `tests/zotero/annotations.test.ts`。
4. 运行测试。

验收：

- 测试断言两个 tags 都存在。

## Exercise 5: 新增 memory parse cache

目标：理解 ParseCache 抽象。

步骤：

1. 在测试里实现 `MemoryParseCache`。
2. 让它把 raw files 存进数组。
3. 用它测试 `ParseService.parse()`。

验收：

- 能解释为什么真实 workflow 用 PDF sibling cache，而测试用 memory cache。

