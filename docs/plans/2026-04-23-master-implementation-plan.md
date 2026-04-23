# Structured Literature Workspace Master Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a Zotero 8/9-oriented structured literature workspace MVP that parses PDF papers with MinerU, normalizes them into stable block-level entities, supports structured reading inside Zotero, and exports durable artifacts to a local vault for later AI and Obsidian workflows.

**Architecture:** Keep the system split into six layers: Zotero integration, MinerU access, parsing orchestration, normalization and internal models, UI interaction, and persistence and AI extension. Every feature must pass through the normalization layer before it can reach UI, export, or AI workflows. All implementation should optimize for stable schemas, deterministic IDs, traceability to the original PDF, and clean extension points rather than premature UI complexity.

**Tech Stack:** TypeScript, Vitest, npm, Zotero plugin packaging, filesystem export helpers, HTTP client support for MinerU, layered domain modules.

## Ground Rules

### Product boundaries

- This is not a generic PDF-to-Markdown plugin.
- This is not a prettier PDF reader.
- This is not yet a full autonomous research agent.
- The product is a block-level structured paper workspace.

### Compatibility baseline

- Minimum target: Zotero 8.
- Forward-compatibility baseline: Zotero 9.
- Avoid Zotero 7-only assumptions unless isolated behind an adapter.

### Non-negotiable architecture rules

- Never render raw MinerU output directly.
- Never mix raw parsed data with AI-derived annotations.
- Never place business logic inside view components if it belongs in normalization or parse orchestration.
- Never skip tests for new behavior in core modules.
- Never let export-specific shaping leak back into the core data model.

### Definition of done for any implementation task

- Behavior is covered by tests where practical.
- `npm test` passes.
- `npm run check` passes.
- `npm run build` passes.
- The change preserves layer boundaries.
- The change updates docs when it changes architecture, schema, or workflow.

## Execution order

Implement in this order and do not reorder without an explicit architectural reason:

1. Tooling and repository baseline
2. Domain schema and normalization
3. MinerU parse flow
4. Zotero runtime adapters
5. Read-only structured UI
6. Vault export
7. AI hooks
8. Stability, packaging, and release readiness

## Phase 0: Repository governance and workflow baseline

**Objective:** Ensure future coding agents inherit the right product definition and execution constraints before major implementation begins.

**Files:**
- Verify: `AGENTS.md`
- Verify: `README.md`
- Verify: `docs/plans/2026-04-23-zotero-structured-literature-workspace.md`
- Create or modify as needed: `docs/plans/*.md`

**Deliverables:**
- One canonical architecture brief
- One master implementation plan
- One current-cycle implementation plan
- Clear Zotero 8/9 compatibility note

**Acceptance criteria:**
- A new coding agent can read the repo and understand scope, sequence, and non-goals without chat history.
- The repo contains one obvious implementation baseline document for the whole project.

## Phase 1: Tooling, packaging baseline, and runtime conventions

**Objective:** Establish a stable TypeScript workspace that supports iterative plugin development without locking in the final packaging strategy too early.

### Task 1.1: Toolchain hardening

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `tsconfig.build.json`
- Create if needed: `vitest.config.ts`
- Create if needed: `eslint.config.js`
- Create if needed: `.editorconfig`

**Implementation notes:**
- Keep scripts minimal and reliable.
- Add only tooling that will be used immediately.
- Prefer strict TypeScript settings and predictable module resolution.

**Acceptance criteria:**
- Tests, type-checking, and build work on a clean checkout.
- The toolchain does not depend on global TypeScript binaries.

### Task 1.2: Plugin packaging scaffold

**Files:**
- Modify: `src/main.ts`
- Create: `src/plugin/manifest.ts`
- Create: `src/plugin/bootstrap.ts`
- Create if needed: `plugin/manifest.json`
- Create if needed: build scripts for packaging

**Implementation notes:**
- Separate runtime bootstrap from metadata.
- Keep the Zotero entry surface thin.
- Store compatibility metadata in one place.

**Acceptance criteria:**
- The codebase has a clear plugin entry module.
- Packaging assumptions for Zotero 8/9 are explicit and isolated.

### Task 1.3: Logging and error conventions

**Files:**
- Create: `src/utils/logger.ts`
- Create: `src/utils/errors.ts`
- Modify call sites as needed

**Implementation notes:**
- Define typed error categories early.
- Keep user-facing messages distinct from debug messages.

**Acceptance criteria:**
- Parse, export, and Zotero adapter layers can raise meaningful typed errors.

## Phase 2: Stable domain schema and normalization core

**Objective:** Finalize the internal model so future UI, AI, and export work do not drift.

### Task 2.1: Freeze the core entity schema

**Files:**
- Modify: `src/model/document.ts`
- Modify: `src/model/block.ts`
- Modify: `src/model/asset.ts`
- Modify: `src/model/relation.ts`
- Modify: `src/model/annotation.ts`
- Create if needed: `src/model/schema-version.ts`
- Update docs: `AGENTS.md`, `README.md`

**Required fields to settle now:**
- `Document`: identity, source, parse metadata, section tree, stats, status
- `Block`: stable ID, type, subtype, section, page range, order, content, caption, asset linkage, related IDs
- `Asset`: file identity, role, source block, path, mime-type where useful
- `Relation`: relation type, source and target, provenance, confidence
- `AIAnnotation`: target binding, annotation kind, model, timestamp

**Acceptance criteria:**
- The schema is versionable.
- The schema is rich enough for text, figure, table, and formula blocks.
- The schema does not contain UI-only or export-only fields.

### Task 2.2: Deterministic block identity and ordering

**Files:**
- Modify: `src/normalize/normalizer.ts`
- Create if needed: `src/normalize/id.ts`
- Test: `tests/model/normalizer.test.ts`

**Implementation notes:**
- IDs must be stable across repeated parsing of the same raw structure.
- Do not rely only on array index if raw order could shift.
- Document the chosen strategy.

**Acceptance criteria:**
- Re-normalizing the same raw payload produces the same block IDs.
- Order is explicit and preserved.

### Task 2.3: Section tree and relation scaffolding

**Files:**
- Modify: `src/normalize/normalizer.ts`
- Create: `src/normalize/section-tree.ts`
- Create: `src/normalize/relation-builder.ts`
- Test: `tests/model/normalizer.test.ts`

**Implementation notes:**
- Build a clean section tree, not just a flat list.
- Start with minimal relations: section membership, ordering, basic references where available.

**Acceptance criteria:**
- The normalized output can drive outline navigation.
- Relation generation is isolated and extensible.

### Task 2.4: Support specialized block families

**Files:**
- Modify: `src/types/mineru.ts`
- Modify: `src/normalize/normalizer.ts`
- Create if needed: `src/normalize/block-builders/*.ts`
- Test: `tests/model/normalizer.test.ts`

**Implementation notes:**
- First-class support for `text`, `figure`, `table`, and `formula`.
- Leave room for heading, caption, list, code, and reference entry subtypes later.

**Acceptance criteria:**
- Specialized blocks normalize without ad hoc field stuffing.

## Phase 3: MinerU integration and parse orchestration

**Objective:** Replace placeholders with a real parse pipeline from local PDF to cached raw outputs plus normalized entities.

### Task 3.1: Provider contracts and configuration

**Files:**
- Modify: `src/mineru/client.ts`
- Modify: `src/mineru/config.ts`
- Modify: `src/prefs/settings.ts`
- Test: `tests/parse/parse-service.test.ts`

**Implementation notes:**
- Separate provider-agnostic contracts from provider-specific options.
- Define timeouts, retry limits, and error mapping.

**Acceptance criteria:**
- Agent and Standard backends can share a common orchestration service.

### Task 3.2: Real Agent API workflow

**Files:**
- Modify: `src/mineru/provider-agent.ts`
- Create if needed: `src/mineru/http.ts`
- Create if needed: `src/mineru/schemas.ts`
- Test: `tests/parse/provider-agent.test.ts`

**Implementation notes:**
- Implement task creation.
- Implement local file upload.
- Implement polling with timeout and terminal states.
- Implement result retrieval and raw file extraction.
- Validate responses before handing them to normalization.

**Acceptance criteria:**
- A real local PDF path can produce raw outputs from the Agent API.
- All unhappy paths are mapped to clear errors.

### Task 3.3: Parse cache and reuse policy

**Files:**
- Modify: `src/parse/parse-cache.ts`
- Modify: `src/parse/parse-service.ts`
- Create if needed: `src/parse/cache-key.ts`
- Test: `tests/parse/parse-service.test.ts`

**Implementation notes:**
- Cache by Zotero item key plus parse inputs that affect output validity.
- Keep raw payloads and normalized payloads distinct.
- Decide whether cache is read-through or write-through.

**Acceptance criteria:**
- Repeat parse requests can reuse results where valid.
- Cache invalidation strategy is documented.

### Task 3.4: Parse status tracking

**Files:**
- Modify: `src/parse/parse-task.ts`
- Modify: `src/parse/parse-service.ts`
- Create if needed: `src/parse/events.ts`
- Test: `tests/parse/parse-task.test.ts`

**Implementation notes:**
- Track idle, queued, running, success, failure, cancelled if needed.
- Keep state transportable to UI.

**Acceptance criteria:**
- UI can observe parse status without knowing provider internals.

## Phase 4: Zotero runtime adapters and selection flow

**Objective:** Bridge the testable core to actual Zotero objects while isolating host-specific behavior.

### Task 4.1: Selection and attachment resolution against Zotero runtime

**Files:**
- Modify: `src/zotero/selection.ts`
- Modify: `src/zotero/attachment.ts`
- Create: `src/zotero/runtime.ts`
- Test: `tests/zotero/selection.test.ts`

**Implementation notes:**
- Keep pure resolution helpers.
- Add a thin runtime adapter that reads the actual Zotero selection and converts it into internal shapes.

**Acceptance criteria:**
- The plugin can resolve a selected PDF attachment or the first PDF child of a selected parent item.

### Task 4.2: Metadata extraction

**Files:**
- Modify: `src/zotero/metadata.ts`
- Test: `tests/zotero/metadata.test.ts`

**Implementation notes:**
- Extract title, authors, year, DOI, tags, attachment paths, and stable identifiers.
- Keep lossy formatting decisions out of this layer.

**Acceptance criteria:**
- Normalization and export receive consistent metadata regardless of Zotero item variation.

### Task 4.3: Command registration and panel host hooks

**Files:**
- Modify: `src/main.ts`
- Modify: `src/plugin/bootstrap.ts`
- Create if needed: `src/zotero/commands.ts`
- Test if practical: `tests/plugin/bootstrap.test.ts`

**Implementation notes:**
- Register one parse command first.
- Register one panel opening command first.
- Avoid adding feature-specific commands until the baseline flow works.

**Acceptance criteria:**
- The plugin entry surface is small, explicit, and easy to evolve.

## Phase 5: Structured reading UI MVP

**Objective:** Provide a functional read-only structured reading experience inside Zotero without over-designing the interface.

### Task 5.1: Panel shell and tab routing

**Files:**
- Modify: `src/ui/panel.ts`
- Create: `src/ui/state.ts`
- Create: `src/ui/render.ts`
- Test if practical: `tests/ui/panel.test.ts`

**Implementation notes:**
- Keep state outside rendering.
- Tabs should be Outline, Cards, Visuals, Export.

**Acceptance criteria:**
- The panel can render placeholder and loaded states.

### Task 5.2: Outline view

**Files:**
- Create: `src/ui/outline-view.ts`
- Test if practical: `tests/ui/outline-view.test.ts`

**Implementation notes:**
- Drive this entirely from normalized section tree data.
- Clicking a section should filter the card list state.

**Acceptance criteria:**
- A parsed document can be navigated by section.

### Task 5.3: Cards view

**Files:**
- Create: `src/ui/cards-view.ts`
- Create if needed: `src/ui/components/block-card.ts`
- Test if practical: `tests/ui/cards-view.test.ts`

**Implementation notes:**
- Show type, section, page range, preview text, and available actions.
- Do not add complex inline editing yet.

**Acceptance criteria:**
- Text and specialized blocks are readable as structured cards.

### Task 5.4: Visuals view

**Files:**
- Create: `src/ui/visuals-view.ts`
- Test if practical: `tests/ui/visuals-view.test.ts`

**Implementation notes:**
- Show figures, tables, and formulas grouped by type.
- Use normalized specialized block fields, not ad hoc raw data extraction in the view.

**Acceptance criteria:**
- Visual blocks are easy to browse independently of linear order.

### Task 5.5: Reader actions

**Files:**
- Modify UI modules as needed
- Create: `src/ui/actions.ts`

**Required actions for MVP:**
- Jump to PDF
- Summarize block placeholder
- Export document

**Acceptance criteria:**
- The action model is defined even where implementation is still placeholder.

## Phase 6: Vault export and persistence

**Objective:** Persist structured results into a local vault layout that works as a semi-durable knowledge base.

### Task 6.1: Path and naming strategy

**Files:**
- Modify: `src/export/vault-exporter.ts`
- Create: `src/export/path-resolver.ts`
- Test: `tests/export/path-resolver.test.ts`

**Implementation notes:**
- Folder names should be deterministic and human-readable.
- Handle illegal path characters and missing metadata safely.

**Acceptance criteria:**
- Export paths are stable and safe.

### Task 6.2: Core artifact export

**Files:**
- Modify: `src/export/vault-exporter.ts`
- Create: `src/export/json-exporter.ts`
- Create: `src/export/markdown-exporter.ts`
- Test: `tests/export/vault-exporter.test.ts`

**Required outputs:**
- `paper.md`
- `full.md`
- `document.json`
- `metadata.json`

**Acceptance criteria:**
- A parsed document exports into the expected folder layout with correct content and traceability.

### Task 6.3: Per-block and asset export

**Files:**
- Modify export modules
- Create if needed: `src/export/block-exporter.ts`
- Test: `tests/export/block-exporter.test.ts`

**Implementation notes:**
- Export one markdown file per block in `blocks/`.
- Export extracted assets in `assets/`.
- Preserve block-to-asset references.

**Acceptance criteria:**
- Blocks can be referenced individually in a vault workflow.

### Task 6.4: Export update policy

**Files:**
- Modify export modules
- Update docs

**Implementation notes:**
- Decide overwrite, merge, or versioned behavior.
- Raw outputs, human notes, and AI notes must not silently overwrite one another.

**Acceptance criteria:**
- Re-exporting a document is predictable and documented.

## Phase 7: AI extension surface, not full AI product

**Objective:** Expose clean AI action boundaries without embedding model-specific logic into the core system.

### Task 7.1: Action contracts

**Files:**
- Modify: `src/ai/provider.ts`
- Create: `src/ai/actions.ts`
- Create: `src/ai/annotations.ts`
- Test: `tests/ai/actions.test.ts`

**Required actions:**
- summarize block
- explain figure
- explain table
- explain formula
- summarize section

**Acceptance criteria:**
- UI can call AI actions through interfaces without knowing provider details.

### Task 7.2: Annotation persistence

**Files:**
- Modify: `src/model/annotation.ts`
- Modify export layer as needed
- Test: `tests/ai/annotations.test.ts`

**Implementation notes:**
- AI annotations must bind to `Document` or `Block` targets.
- Keep AI content in dedicated storage paths.

**Acceptance criteria:**
- AI outputs can be stored and exported without mutating raw data.

## Phase 8: Stability, performance, and operational readiness

**Objective:** Make the MVP usable for real papers and robust enough for iterative testing.

### Task 8.1: Failure handling and user messaging

**Files:**
- Modify parse, export, and UI layers
- Add tests where practical

**Acceptance criteria:**
- Common failures show actionable messages.
- One failed parse does not break the plugin session.

### Task 8.2: Performance guardrails

**Files:**
- Modify parse and UI layers as needed

**Areas to address:**
- Avoid blocking the UI thread during parse polling.
- Handle medium and long papers without degenerate list rendering.
- Avoid duplicate work on repeated exports and parses.

**Acceptance criteria:**
- Baseline performance is acceptable for typical academic PDFs.

### Task 8.3: Manual QA matrix

**Files:**
- Create: `docs/testing/manual-qa.md`

**Scenarios:**
- selected attachment is a PDF
- selected parent item has one PDF
- selected parent item has multiple attachments
- no PDF found
- MinerU timeout
- malformed MinerU response
- export to empty vault
- re-export existing paper
- figures and formulas present

**Acceptance criteria:**
- The project has a repeatable manual validation checklist.

### Task 8.4: Packaging and release prep

**Files:**
- Create: release notes and packaging docs as needed
- Create if needed: `docs/release/mvp-checklist.md`

**Acceptance criteria:**
- The repo can produce a testable plugin artifact.
- Installation steps are documented.

## Phase 9: Explicit post-MVP backlog

These are valid future directions but must not distort MVP implementation:

- cross-paper retrieval and comparison
- richer relation extraction like `supports_claim` and `shares_method_with`
- bidirectional Obsidian sync
- AI-generated section and paper workspaces
- corpus-level synthesis and contradiction detection
- similarity search over block embeddings
- advanced UI polish and visual analytics

## Delivery protocol for future coding agents

For each meaningful implementation cycle, the agent must provide:

- what was built
- which files changed
- what assumptions were made
- what remains incomplete
- what tests were added or updated
- which phase and tasks from this plan were addressed next

## Recommended implementation sequence for the next few cycles

### Cycle A

- Phase 1.2 plugin packaging scaffold
- Phase 1.3 logging and error conventions
- Phase 2.1 schema freeze
- Phase 2.2 deterministic IDs hardening

### Cycle B

- Phase 3.1 provider contracts
- Phase 3.2 real Agent API workflow
- Phase 3.4 parse status tracking

### Cycle C

- Phase 4.1 Zotero runtime adapters
- Phase 4.2 metadata extraction
- Phase 5.1 panel shell
- Phase 5.2 outline view

### Cycle D

- Phase 5.3 cards view
- Phase 5.4 visuals view
- Phase 6.1 path strategy
- Phase 6.2 core artifact export

### Cycle E

- Phase 6.3 per-block export
- Phase 7.1 AI action contracts
- Phase 8.1 failure handling
- Phase 8.3 manual QA matrix

## Stop conditions

Pause and seek clarification instead of guessing if any of these occur:

- Zotero 8/9 host APIs differ in a way that affects architecture
- MinerU response shape differs materially from current assumptions
- export semantics conflict with how Obsidian notes should remain durable
- stable block ID strategy cannot remain deterministic under real parse data
- a requested feature would push raw, human, and AI layers into one store

## Final reminder

Every implementation decision should be judged by one question:

Does this make the paper a better structured knowledge workspace, or does it just add another PDF feature?

If it only adds another PDF feature, it is probably out of scope.
