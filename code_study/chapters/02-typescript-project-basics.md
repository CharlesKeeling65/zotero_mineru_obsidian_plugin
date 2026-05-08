# 02. TypeScript Project Basics

本章目标：通过这个项目学习 TypeScript 工程基础。

## 1. 为什么使用 TypeScript

这个项目需要维护多层数据契约：

- MinerU raw document
- Internal `Document`
- Internal `Block`
- Translation request
- Zotero annotation payload

TypeScript 的价值是让这些契约在编译期可检查，而不是等 Zotero runtime 报错。

官方文档：

- TypeScript Handbook: <https://www.typescriptlang.org/docs/handbook/intro.html>
- Everyday Types: <https://www.typescriptlang.org/docs/handbook/2/everyday-types.html>

## 2. `tsconfig.json`

本项目使用：

```json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "strict": true
}
```

解释：

| 配置 | 含义 |
| --- | --- |
| `target: ES2022` | 输出现代 JavaScript，适合当前 Node/Zotero 方向。 |
| `module: NodeNext` | 使用 Node.js ESM 规则，需要写 `.js` import 后缀。 |
| `moduleResolution: NodeNext` | 让 TypeScript 按 Node ESM 方式解析模块。 |
| `strict: true` | 开启严格类型检查，减少隐式 `any` 和空值错误。 |

官方文档：

- TSConfig reference: <https://www.typescriptlang.org/tsconfig/>
- Node.js ECMAScript modules: <https://nodejs.org/api/esm.html>
- TypeScript modules: <https://www.typescriptlang.org/docs/handbook/2/modules.html>

## 3. 接口是架构边界

例子：`src/mineru/client.ts`

```ts
export interface MineruProvider {
  readonly backendName: string;
  parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput>;
}
```

这个接口表达的是：

- 上层只需要知道“能解析 PDF”。
- 上层不需要知道 Agent API 怎么上传文件。
- 未来接入 Standard API 或 local MinerU 时，只要实现同一接口即可。

这是依赖倒置原则的简单实践。

对应官方文档：

- Object types: <https://www.typescriptlang.org/docs/handbook/2/objects.html>

## 4. `type` 和 `interface` 怎么选

本项目常见模式：

```ts
export type BlockType = "text" | "figure" | "table" | "formula";

export interface Block {
  blockId: string;
  type: BlockType;
}
```

经验规则：

- 用 `type` 表示 union、literal、组合类型。
- 用 `interface` 表示对象契约。
- 对外暴露的数据结构优先清晰，而不是追求复杂类型技巧。

## 5. `Promise` 和 async workflow

MinerU 解析是异步流程：

```text
create task -> upload -> poll -> download
```

因此 provider 方法返回：

```ts
parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput>;
```

学习重点：

- API 调用是异步的。
- 文件写入是异步的。
- 测试需要 `await`。

官方文档：

- MDN Promise: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise>
- MDN async function: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function>

## 6. ESM import 后缀

你会看到：

```ts
import { normalizeMineruDocument } from "../normalize/normalizer.js";
```

虽然源文件是 `.ts`，import 里却写 `.js`。这是 NodeNext/ESM 工程中的常见写法，因为编译后的文件扩展名是 `.js`。

官方文档：

- Node.js ESM mandatory file extensions: <https://nodejs.org/api/esm.html#mandatory-file-extensions>

## 7. 初学者练习

1. 打开 `src/model/block.ts`，给 `BlockType` 增加一个临时类型 `"unknown"`。
2. 运行 `npm run check`，观察哪些地方需要适配。
3. 撤回这个改动。
4. 打开 `src/translate/provider.ts`，解释 `ParagraphTranslationRequest` 每个字段的作用。

