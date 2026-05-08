# 08. Testing and Debugging

本章目标：理解项目如何用自动化测试保护核心链路。

## 1. 测试分层

| 测试类型 | 文件 | 目的 |
| --- | --- | --- |
| Python unit test | `tests/python/test_mineru_agent_parse.py` | 验证 Python MinerU client 流程和上传 header。 |
| Provider test | `tests/parse/provider-agent.test.ts` | 验证 TypeScript MinerU provider 请求/轮询逻辑。 |
| Parse service test | `tests/parse/parse-service.test.ts` | 验证 provider/cache/normalizer 编排。 |
| Markdown test | `tests/parse/markdown-preprocessor.test.ts` | 验证真实 Markdown 拆分为 102 blocks。 |
| Normalizer test | `tests/model/normalizer.test.ts` | 验证 block ID 稳定性和模型输出。 |
| Zotero tests | `tests/zotero/*.test.ts` | 验证 selection、text-location、annotation payload、workflow。 |

## 2. Vitest 基础

运行全部测试：

```bash
npm test
```

运行单个测试文件：

```bash
npm test -- tests/zotero/annotations.test.ts
```

官方文档：

- Vitest guide: <https://vitest.dev/guide/>
- Vitest API: <https://vitest.dev/api/>
- Vitest mocking: <https://vitest.dev/guide/mocking>

## 3. 测试替身

本项目大量使用 fake object，而不是调用真实外部服务：

- fake MinerU provider
- fake ParseCache
- fake TranslationProvider
- fake Zotero text-location provider
- fake annotation writer

这样测试稳定、快速、可离线运行。

示例思路：

```text
真实对象：MinerU HTTP API
测试替身：返回固定 Markdown 的 fake provider
```

## 4. Python unittest

运行：

```bash
python -m unittest tests/python/test_mineru_agent_parse.py
```

官方文档：

- Python unittest: <https://docs.python.org/3/library/unittest.html>
- Python Protocol: <https://docs.python.org/3/library/typing.html#typing.Protocol>

## 5. Debug真实 Markdown 拆分

只看测试通过不够，初学者应该学会看中间产物：

```bash
npm run build
npm run inspect:markdown-blocks -- "/absolute/path/to/paper.md" 8
```

这个脚本会输出 JSON，方便检查：

- block 数量
- sectionPath
- coreSection
- order
- paragraph text preview

## 6. 常见失败定位

| 现象 | 可能原因 | 看哪里 |
| --- | --- | --- |
| `npm run check` 失败 | 类型不匹配或 import 后缀错误 | TypeScript 报错行 |
| `npm run build` 失败 | `src/` 编译问题 | `tsconfig.build.json` |
| Provider test 失败 | API envelope 或 poll 状态处理错误 | `src/mineru/provider-agent.ts` |
| Markdown count 不是 102 | 拆分规则变化或真实 Markdown 文件变化 | `src/parse/markdown-preprocessor.ts` |
| Annotation rects 为空 | text-location provider 未提供或匹配失败 | `src/zotero/text-location.ts` |

## 7. 初学者练习

1. 故意把 `GRAY_TRANSLATION_ANNOTATION_COLOR` 改成另一个颜色，运行 annotation test 看失败信息。
2. 恢复颜色。
3. 给 `normalizeMineruDocument()` 增加一个测试：同一输入 normalize 两次，block IDs 相同。
4. 给 Python fake transport 加一个 HTTP 500 响应测试。

