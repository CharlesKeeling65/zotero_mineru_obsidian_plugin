# Structured Literature Workspace

Zotero 8/9 plugin baseline for turning a selected paper PDF into a structured, paragraph-level literature workspace using MinerU as the parser and Zotero as the reading surface.

This is not a generic PDF-to-Markdown utility. The project is building the infrastructure for block-level academic reading, translation, export, and future AI-assisted understanding.

## Current Status

Implemented:

- MinerU Agent API flow for local PDF parsing in Python: create task, upload PDF, poll result, download Markdown, and save it next to the source PDF with the same base name.
- TypeScript MinerU Agent provider with task creation, signed upload, polling, Markdown download, raw-file persistence, and provider abstraction for future backends.
- Zotero PDF selection helpers and a workflow wrapper that stores MinerU outputs beside the selected attachment PDF.
- Markdown preprocessing fallback that splits the MinerU `Article` Markdown body into ordered paragraph `text` blocks when MinerU does not return layout blocks.
- Normalization into typed internal entities: `Document`, `Block`, `Asset`, `Relation`, and `AIAnnotation`.
- Deterministic block IDs based on stable document/block inputs while preserving explicit `order`.
- Contextual paragraph translation interface that receives the full document, section path, previous paragraph, and next paragraph.
- Zotero annotation payload builder for gray translation cards: the highlighted quote is the source paragraph and the annotation comment is the translation.
- Plugin manifest/bootstrap modules and lightweight logger/error primitives.
- Unit tests for parsing, normalization, bootstrap, errors, markdown splitting, contextual translation, Zotero annotation payloads, and the integrated MinerU workflow.

Not implemented yet:

- Packaged Zotero UI/menu command for invoking the full workflow from the Zotero reader.
- Real Zotero Reader text-location lookup for paragraph-to-PDF rectangle mapping.
- True page-anchored highlights. Current annotation payloads intentionally contain empty `position.rects` because MinerU fast Agent Markdown does not provide layout coordinates.
- Real translation API provider. The current translation layer is an interface and workflow integration point.
- Vault export beyond the current raw Markdown/JSON baseline.
- Settings UI for API keys, vault paths, translation providers, and workflow options.

## Workflow

```text
Selected Zotero PDF
  -> MinerU Agent parse
  -> sibling Markdown output
  -> Markdown Article preprocessing
  -> ordered paragraph RawMineruBlock[]
  -> normalized Document/Block model
  -> contextual paragraph translation provider
  -> gray Zotero translation annotation payloads
  -> future Zotero.Annotations.saveFromJSON runtime write
```

## Core Modules

| Area | File | Responsibility |
| --- | --- | --- |
| Python MinerU debug flow | `scripts/mineru_agent_parse.py` | Parses one local PDF with MinerU Agent API and writes sibling `.md`. |
| MinerU TypeScript provider | `src/mineru/provider-agent.ts` | Creates MinerU Agent tasks, uploads PDFs, polls status, downloads Markdown. |
| Parse orchestration | `src/parse/parse-service.ts` | Runs provider, persists raw files, preprocesses Markdown fallback, normalizes output. |
| Markdown preprocessing | `src/parse/markdown-preprocessor.ts` | Extracts the `Article` body, stops before references-like sections, skips Markdown tables, emits ordered paragraph text blocks. |
| Internal model | `src/model/` | Defines document, block, asset, relation, annotation, and schema-version types. |
| Normalization | `src/normalize/normalizer.ts` | Converts raw MinerU-shaped data into internal schema with deterministic block IDs and section tree. |
| Translation interface | `src/translate/provider.ts` | Defines `translateParagraph(request)`. |
| Translation orchestration | `src/translate/contextual-translator.ts` | Sends each text block to the translation provider with full-document and neighbor context. |
| Zotero annotations | `src/zotero/annotations.ts` | Builds gray highlight annotation payloads and wraps `Zotero.Annotations.saveFromJSON`. |
| Zotero workflow | `src/zotero/mineru-workflow.ts` | Resolves selected PDF, runs parsing, writes sibling files, optionally translates and creates annotations. |
| Markdown inspection | `scripts/inspect_markdown_blocks.mjs` | Prints real Markdown split results after `npm run build`. |
| Public exports | `src/main.ts` | Re-exports plugin, MinerU, preprocessing, translation, and annotation APIs. |

## MinerU Agent Parameters

Python debug script: `scripts/mineru_agent_parse.py`

| Parameter | Location | Default | Meaning |
| --- | --- | --- | --- |
| `pdf_path` | CLI positional argument | required | Local PDF to parse. |
| `--base-url` | CLI option | `https://mineru.net/api/v1/agent` | MinerU Agent API base URL. |
| `--poll-interval` | CLI option | `3` seconds | Poll interval for task status. |
| `--timeout` | CLI option | `300` seconds | Max wait for task completion. |
| `language` | `MineruAgentClient.parse_file()` | `ch` | MinerU language hint. |
| `enable_table` | `MineruAgentClient.parse_file()` | `true` | Ask MinerU to parse tables. |
| `is_ocr` | `MineruAgentClient.parse_file()` | `false` | OCR mode flag. |
| `enable_formula` | `MineruAgentClient.parse_file()` | `true` | Ask MinerU to parse formulas. |
| `page_range` | `MineruAgentClient.parse_file()` | unset | Optional page range for parsing. |

TypeScript provider: `src/mineru/provider-agent.ts`

| Parameter | Location | Default | Meaning |
| --- | --- | --- | --- |
| `baseUrl` | `MineruAgentConfig` | required by caller | MinerU Agent API base URL. |
| `apiKey` | `MineruAgentConfig` | optional | Sent as `Authorization: Bearer <apiKey>` for JSON API calls. |
| `timeoutMs` | `MineruAgentConfig` | `300000` | Max status polling duration. |
| `pollIntervalMs` | `MineruAgentConfig` | `3000` | Status polling interval. |
| `file_name` | create-task request body | PDF basename | MinerU upload filename. |
| `language` | create-task request body | `ch` | MinerU language hint. |
| `enable_table` | create-task request body | `true` | Table parsing flag. |
| `is_ocr` | create-task request body | `false` | OCR parsing flag. |
| `enable_formula` | create-task request body | `true` | Formula parsing flag. |

Important upload detail: signed upload URLs must not receive an arbitrary non-empty `Content-Type` header. The Python transport explicitly sends an empty `Content-Type` to avoid OSS `SignatureDoesNotMatch` failures. The TypeScript `fetch` upload does not set `Content-Type`.

## Markdown Paragraph Splitting

When MinerU returns only Markdown, `ensureMarkdownTextBlocks()` creates fallback text blocks before normalization.

Rules currently implemented in `src/parse/markdown-preprocessor.ts`:

- Start after a standalone `Article` marker when present.
- Treat Markdown headings as section boundaries.
- Stop before references-like terminal sections such as `References`, `Bibliography`, `Acknowledgments`, `Author Contributions`, `Competing Interests`, and `Supplementary`.
- Split paragraphs on blank lines.
- Join soft-wrapped lines inside the same paragraph.
- Skip pure Markdown table paragraphs.
- Set fallback `pageStart` and `pageEnd` to `1` because MinerU fast Agent Markdown does not contain layout coordinates.
- Preserve explicit paragraph order as `order: 1..n`.

### How to Verify Splitting With the Real MinerU Markdown

The split behavior is tested against the real MinerU Markdown generated from the Wang et al. 2026 PDF:

```text
/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md
```

The test file is `tests/parse/markdown-preprocessor.test.ts`. It reads that real Markdown path by default, or reads `REAL_MINERU_MARKDOWN_PATH` when the environment variable is set.

```bash
npm test -- tests/parse/markdown-preprocessor.test.ts
```

Current assertions for that real Markdown:

- The Markdown splits into `102` ordered text blocks.
- Block `1` is under the paper-title section and contains the received date.
- Block `6` contains the abstract opening paragraph.
- Block `14` is under the `Divergent estimates in evaluating manure recycling` section.
- The final block is under `Code availability`.
- No generated block is assigned to the `References` section.

To inspect the actual split output instead of only seeing a test pass/fail result, build once and run:

```bash
npm run build
npm run inspect:markdown-blocks -- "/Users/wyb/File/Seafile/Obsidian_repository/Research-knowledge_base/Reading Papers/0_All_Paper_PDF/2026/Nature Food/Wang 等 - 2026 - A framework for estimating manure nitrogen balance and recyc.md" 8
```

The command prints JSON with `blockCount`, the first N blocks, and the last 3 blocks so paragraph boundaries and section assignment can be reviewed directly.

## Translation and Zotero Annotation Payloads

Translation request shape: `src/translate/provider.ts`

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

Annotation payload shape: `src/zotero/annotations.ts`

```ts
interface ZoteroTranslationAnnotationPayload {
  key: string;
  type: "highlight";
  text: string;
  comment: string;
  color: "#aaaaaa";
  pageLabel: string;
  sortIndex: string;
  position: {
    pageIndex: number;
    rects: number[][];
  };
  tags: [{ name: "mineru-translation" }];
}
```

Current behavior:

- `text` is the source paragraph shown as the highlight quote.
- `comment` is the translated paragraph shown in the Zotero annotation card.
- `color` is gray: `#aaaaaa`.
- `tags` includes `mineru-translation`.
- `position.rects` is currently empty. This must be filled later from Zotero Reader text-location lookup, not from MinerU fast Agent Markdown.

Zotero reference context:

- Zotero stores PDF reader annotations in its database: <https://www.zotero.org/support/kb/annotations_in_database>
- Zotero local JavaScript API docs are intentionally limited and often require source inspection: <https://www.zotero.org/support/dev/client_coding/javascript_api>
- Runtime write adapter currently targets `Zotero.Annotations.saveFromJSON`.

## Local MinerU Debug Command

```bash
python scripts/mineru_agent_parse.py "/absolute/path/to/paper.pdf"
```

Expected result:

- Creates `/absolute/path/to/paper.md`.
- The output Markdown is written beside the PDF.
- The output base name matches the PDF base name.

The live debug flow has been tested against a real PDF and produced sibling Markdown. Network access and MinerU account/API availability are external requirements.

## Test and Build

```bash
npm test
npm run check
npm run build
npm run inspect:markdown-blocks -- "/absolute/path/to/paper.md" 8
python -m unittest tests/python/test_mineru_agent_parse.py
```

Current verified baseline:

- `npm test`: unit tests for TypeScript parse/normalize/Zotero/translation modules.
- `npm run check`: TypeScript type-check.
- `npm run build`: compile `src/` to `dist/`.
- `npm run inspect:markdown-blocks -- <markdown> <count>`: prints real Markdown block split output for manual review.
- Python unit tests cover the local MinerU debug client and signed upload header behavior.

## Repository Layout

```text
src/
  ai/
  export/
  main.ts
  mineru/
  model/
  normalize/
  parse/
  plugin/
  prefs/
  translate/
  types/
  ui/
  utils/
  zotero/
scripts/
tests/
docs/plans/
```

## Zotero Compatibility Baseline

This repository targets Zotero 8 as the minimum baseline and keeps Zotero 9 forward compatibility in mind. New code should avoid Zotero 7-only assumptions unless isolated behind an adapter.

For annotation anchoring, the next technical step is Zotero Reader text-location lookup: locate each source paragraph in the PDF text layer, derive page rectangles, and populate `position.rects` before calling `Zotero.Annotations.saveFromJSON`.

## Roadmap

1. Add a real Zotero runtime command/menu entry that starts the MinerU workflow from a selected PDF attachment.
2. Implement Zotero Reader text-location matching for paragraph-to-rectangle anchoring.
3. Add a real translation provider implementation and settings for credentials/model selection.
4. Persist normalized documents and translation annotation metadata beside the source PDF or in the configured vault.
5. Expand vault export to `paper.md`, `full.md`, `document.json`, `metadata.json`, per-block files, assets, and AI outputs.
6. Add the minimal Zotero panel for Outline, Cards, Visuals, and Export views.

## Canonical Planning Docs

- Master plan: `docs/plans/2026-04-23-master-implementation-plan.md`
- Initial scaffold plan: `docs/plans/2026-04-23-zotero-structured-literature-workspace.md`
