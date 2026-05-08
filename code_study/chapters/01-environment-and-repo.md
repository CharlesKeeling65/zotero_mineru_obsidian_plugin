# 01. Environment and Repository

本章目标：把项目跑起来，并理解每个目录的作用。

## 1. 环境要求

`package.json` 指定 Node.js 版本：

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

官方文档：

- Node.js: <https://nodejs.org/en>
- npm CLI: <https://docs.npmjs.com/cli>

## 2. 安装依赖

```bash
npm install
```

这个项目当前只有开发依赖：

- `typescript`: 编译和类型检查。
- `vitest`: TypeScript 单元测试。
- `@types/node`: Node.js 类型声明。

官方文档：

- TypeScript install: <https://www.typescriptlang.org/download/>
- Vitest guide: <https://vitest.dev/guide/>

## 3. 运行验证命令

```bash
npm test
npm run check
npm run build
python -m unittest tests/python/test_mineru_agent_parse.py
```

每个命令的意义：

| 命令 | 作用 |
| --- | --- |
| `npm test` | 运行 Vitest 单元测试，验证 TypeScript 业务逻辑。 |
| `npm run check` | 执行 `tsc --noEmit`，只检查类型，不输出文件。 |
| `npm run build` | 执行 `tsc -p tsconfig.build.json`，把 `src/` 编译到 `dist/`。 |
| `python -m unittest ...` | 验证 Python MinerU 调试脚本的可测试行为。 |

## 4. 仓库目录

```text
src/
  ai/          AI 扩展接口，当前是预留点
  export/      vault export 方向
  mineru/      MinerU API provider
  model/       内部结构化数据模型
  normalize/   raw MinerU -> internal model
  parse/       parse application service 和 Markdown preprocessing
  plugin/      Zotero 插件 manifest/bootstrap
  prefs/       设置项类型
  translate/   段落翻译接口和编排
  types/       MinerU raw 类型
  ui/          Zotero panel UI baseline
  utils/       logger/error primitives
  zotero/      Zotero selection/text-location/annotation workflow
scripts/       Python 和 Node 调试脚本
tests/         TypeScript 和 Python 测试
docs/plans/    项目计划文档
code_study/    本学习目录
```

## 5. 学习时如何读目录

不要从 `src/main.ts` 一路跳到底。更好的顺序是：

1. 读 `src/model/`，先知道最终数据长什么样。
2. 读 `src/mineru/client.ts`，知道 provider 的输入输出。
3. 读 `src/parse/parse-service.ts`，看核心编排。
4. 读 `src/parse/markdown-preprocessor.ts`，看真实 Markdown 如何拆段。
5. 读 `src/normalize/normalizer.ts`，看 block ID 和 section tree。
6. 读 `src/zotero/mineru-workflow.ts`，看 Zotero 端到端集成。

## 6. 初学者练习

1. 运行 `npm test` 并记录通过的测试文件数量。
2. 打开 `tests/parse/parse-service.test.ts`，找出 fake provider 和 fake cache。
3. 修改 fake provider 返回两个 raw files，断言 cache 被调用两次。
4. 恢复或保留修改后运行 `npm test`。

