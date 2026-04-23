# Structured Literature Workspace

Zotero 8/9 plugin scaffold for a MinerU-backed structured literature workspace.

## Scope

This repository is the initial engineering baseline for a plugin that turns a Zotero paper from a flat PDF attachment into structured blocks that can later support:

- section-based reading
- figure, table, and formula browsing
- local vault export for Obsidian-style workflows
- AI-assisted paper understanding

The current repository focuses on architecture and core primitives, not a full working Zotero UI yet.

## Current State

Implemented in this scaffold:

- TypeScript workspace with tests
- `AGENTS.md` aligned to the structured-literature product definition
- typed core models: `Document`, `Block`, `Asset`, `Relation`, `AIAnnotation`
- MinerU provider abstraction with Agent and Standard placeholders
- parse orchestration service
- normalization pipeline from raw MinerU-shaped data into internal models
- Zotero PDF selection helpers
- minimal plugin manifest bootstrap targeting Zotero 8/9
- vault export placeholder
- AI provider interface placeholder

Not implemented yet:

- real Zotero host integration
- real MinerU HTTP upload and polling
- panel rendering inside Zotero
- settings UI
- per-block vault export
- AI execution

## Canonical Planning Docs

- Master plan: [docs/plans/2026-04-23-master-implementation-plan.md](/Users/wyb/File/Programming/Git_Code/zotero_mineru_obsidian_plugin/docs/plans/2026-04-23-master-implementation-plan.md)
- Initial scaffold plan: [docs/plans/2026-04-23-zotero-structured-literature-workspace.md](/Users/wyb/File/Programming/Git_Code/zotero_mineru_obsidian_plugin/docs/plans/2026-04-23-zotero-structured-literature-workspace.md)

Future coding agents should treat the master plan as the project-level source of truth for scope, sequencing, and guardrails.

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
  prefs/
  types/
  ui/
  zotero/
tests/
docs/plans/
```

## Scripts

- `npm test`: run unit tests
- `npm run check`: run TypeScript type-checking
- `npm run build`: compile `src/` to `dist/`

## Zotero Compatibility Baseline

This scaffold assumes Zotero 8 as the minimum target and treats Zotero 9 as the forward-compatibility baseline for API choices and repository documentation. New code should avoid Zotero 7-specific assumptions unless explicitly isolated behind a compatibility adapter.

## Next Recommended Cycle

1. Replace placeholder MinerU providers with real task creation, upload, polling, and result download.
2. Add a proper Zotero runtime adapter layer around the pure selection helpers.
3. Introduce a minimal panel shell that can render outline and block cards from normalized data.
4. Expand vault export from `full.md` and `document.json` to per-block markdown and assets.
