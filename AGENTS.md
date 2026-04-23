# AGENTS.md

## Mission

Build a Zotero plugin MVP that transforms PDF papers into a structured literature workspace using MinerU as the parsing engine, Zotero as the reading and entry interface, and local vault export as the persistence layer.

This is not a generic PDF-to-Markdown utility.

The project must produce a block-level structured reading system for academic papers, enabling future AI-driven deep understanding workflows.

The implementation baseline must target Zotero 8 and remain forward-compatible with Zotero 9 where practical. Do not design around Zotero 7-only APIs unless a compatibility shim is unavoidable.

## Product Definition

The product turns a paper from:

- one PDF attachment
- one flat reading object

into:

- one structured document
- many typed blocks
- many reusable knowledge units

Core block types for MVP:

- text
- figure
- table
- formula

The plugin must allow users to:

1. select a Zotero PDF
2. parse it with MinerU
3. normalize the output into internal structured data
4. browse it inside Zotero by section and block type
5. export it to a local vault for semi-persistent knowledge use

## Non-Goals

Do not optimize for the following in this phase:

- multi-user collaboration
- complex cloud sync
- full cross-paper knowledge graph
- advanced AI research agent workflows
- end-to-end autonomous literature review
- beautiful but shallow PDF reader redesign

This MVP is about structured reading infrastructure, not visual polish alone.

## Engineering Principles

### 1. Respect the architectural layers

Keep the following layers clearly separated:

- Zotero integration layer
- MinerU API and parsing layer
- normalization and internal model layer
- UI interaction layer
- export and persistence layer
- AI extension layer

Do not collapse them into one mixed implementation.

### 2. Internal schema is mandatory

MinerU raw output must never be treated as the final UI model.

Normalize MinerU output into internal schemas before rendering or exporting.

### 3. Raw, human, and AI outputs must stay separate

Always separate:

- raw parsed data
- human edits and notes
- AI-generated annotations

Never overwrite raw parsing results with AI or user-generated content.

### 4. Build for extensibility

The code must allow future addition of:

- Standard MinerU API provider
- local MinerU backend
- AI providers
- Obsidian bidirectional workflows
- cross-document retrieval

### 5. Favor stable IDs

Every parsed block must have a stable, deterministic ID.
Do not use fragile transient indexes without a strategy.

## MVP Scope

### Required

- Zotero PDF attachment detection
- MinerU Agent API integration
- parsing status tracking
- normalized document model
- block-level rendering
- section tree rendering
- figure, table, and formula classification
- local vault export
- minimal settings page
- basic error handling

### Optional but encouraged

- provider abstraction for future Standard API
- parse result cache
- retry handling
- export of per-block markdown files

### Not required now

- advanced AI inference
- cross-paper block linking
- knowledge graph visualization
- semantic search engine
- automatic literature synthesis

## Internal Data Model

The project must define and use the following primary entities:

- Document
- Block
- Asset
- Relation
- AIAnnotation

### Document

Represents one structured paper instance.

### Block

Represents one typed semantic unit.
MVP block types:

- text
- figure
- table
- formula

### Asset

Represents file-based resources such as images or extracted table assets.

### Relation

Represents relationships between blocks when available.

### AIAnnotation

Represents derived AI content that must not mutate raw source blocks.

## UI Model

The Zotero plugin panel should provide the following tabs or equivalent views:

1. Outline
2. Cards
3. Visuals
4. Export

### Outline

Tree-based section navigation.

### Cards

Sequential block-level browsing.

### Visuals

Specialized browsing for figures, tables, and formulas.

### Export

Actions and state for local vault export.

Do not over-design the UI. The goal is clarity and operational usefulness.

## Vault Export Requirements

The export layer must support a local folder structure like:

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

The export must preserve:

- traceability to Zotero item
- traceability to source PDF
- stable file naming
- correct asset references

## AI Readiness Requirements

Even if advanced AI is not implemented now, the project must leave clean extension points for:

- summarize block
- explain figure
- explain table
- explain formula
- summarize section

Model these as extension interfaces, not hard-coded business logic inside UI components.

## Code Quality Rules

### Required

- TypeScript types for all core models
- explicit module boundaries
- explicit input and output contracts
- clear error messages
- lightweight logging
- no hidden global mutable state

### Avoid

- direct raw MinerU response rendering
- UI-dependent data shaping inside API clients
- giant utility files
- mixing export logic with parsing logic
- mixing AI-derived fields into raw block schemas

## Suggested Directory Layout

```text
src/
  main.ts
  zotero/
  mineru/
  parse/
  model/
  normalize/
  ui/
  export/
  ai/
  prefs/
  utils/
```

The architecture must remain equally clear if a different structure is chosen.

## Execution Strategy

Implement in this order:

1. plugin skeleton
2. Zotero selection and PDF resolution
3. MinerU Agent API parse flow
4. raw result persistence
5. normalization layer
6. basic panel UI
7. vault export
8. AI extension hooks

Do not start from advanced UI polish.
Do not start from AI features.
Do not skip normalization.

## Definition of Done

A task is only done when:

1. code compiles and runs in the intended toolchain
2. behavior is testable manually
3. output matches internal schema expectations
4. errors are surfaced clearly
5. next-layer integration remains clean

## Reporting Style

For each substantial implementation step, provide:

- what was built
- what files changed
- what assumptions were made
- what is incomplete
- what the next step is

Keep progress reports concrete and engineering-oriented.

## Final Reminder

The real product is not a plugin that parses PDFs.
The real product is a structured paper workspace that upgrades Zotero papers from attachments into actionable knowledge units.
