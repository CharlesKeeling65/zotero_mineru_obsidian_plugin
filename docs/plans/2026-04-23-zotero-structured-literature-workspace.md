# Structured Literature Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the initial repository scaffold for a Zotero 8/9-oriented structured literature workspace plugin with typed domain models, a MinerU parsing pipeline skeleton, and a clean architecture ready for later UI and export work.

**Architecture:** Use a layered TypeScript workspace with explicit boundaries between Zotero integration, MinerU clients, parsing orchestration, normalization, export, and AI extension hooks. Prefer a runtime-safe core that can be unit-tested outside Zotero, with Zotero-specific code kept near the entry layer.

**Tech Stack:** TypeScript, Vitest, npm, layered module structure, future Zotero plugin packaging.

### Task 1: Create workspace metadata and toolchain files

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `.gitignore`

**Step 1: Write the failing test**

Add a test that imports a core model or normalization function from `src/` and fails because the module does not exist yet.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module resolution errors.

**Step 3: Write minimal implementation**

Add the package scripts and TypeScript configuration needed to run tests and compile source files.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: test runner starts successfully after core modules are added in later tasks.

**Step 5: Commit**

Commit when the workspace metadata is stable.

### Task 2: Define the core domain model

**Files:**
- Create: `src/model/document.ts`
- Create: `src/model/block.ts`
- Create: `src/model/asset.ts`
- Create: `src/model/relation.ts`
- Create: `src/model/annotation.ts`
- Create: `src/model/index.ts`
- Create: `src/types/mineru.ts`
- Test: `tests/model/normalizer.test.ts`

**Step 1: Write the failing test**

Write tests that assert a raw MinerU-shaped payload normalizes into a `Document` and at least one `text` block with a stable deterministic ID.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`
Expected: FAIL because the model and normalizer modules do not exist yet.

**Step 3: Write minimal implementation**

Create the typed domain entities and enough exports for tests to compile.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: model test passes.

**Step 5: Commit**

Commit after the core schema is stable.

### Task 3: Implement MinerU client scaffolding and parse orchestration

**Files:**
- Create: `src/mineru/config.ts`
- Create: `src/mineru/client.ts`
- Create: `src/mineru/provider-agent.ts`
- Create: `src/mineru/provider-standard.ts`
- Create: `src/parse/parse-task.ts`
- Create: `src/parse/parse-cache.ts`
- Create: `src/parse/parse-service.ts`
- Test: `tests/parse/parse-service.test.ts`

**Step 1: Write the failing test**

Write a test that asserts `ParseService` invokes the provider, stores raw outputs in a cache path, and returns normalized data.

**Step 2: Run test to verify it fails**

Run: `npm test tests/parse/parse-service.test.ts`
Expected: FAIL because the parse modules do not exist yet.

**Step 3: Write minimal implementation**

Implement provider interfaces, Agent provider placeholders, and an in-memory or filesystem cache helper sufficient for tests.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: parse service tests pass.

**Step 5: Commit**

Commit after parse orchestration composes cleanly with normalization.

### Task 4: Add Zotero-facing selection and plugin entry skeleton

**Files:**
- Create: `src/zotero/selection.ts`
- Create: `src/zotero/attachment.ts`
- Create: `src/zotero/metadata.ts`
- Create: `src/main.ts`
- Create: `src/ui/panel.ts`
- Test: `tests/zotero/selection.test.ts`

**Step 1: Write the failing test**

Write tests against narrow adapter helpers that resolve a selected PDF attachment or the first PDF child from a regular item.

**Step 2: Run test to verify it fails**

Run: `npm test tests/zotero/selection.test.ts`
Expected: FAIL because selection helpers do not exist yet.

**Step 3: Write minimal implementation**

Implement pure helper functions and a minimal plugin entry that wires the command surface without full UI.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: selection tests pass.

**Step 5: Commit**

Commit after the plugin-facing edge is in place.

### Task 5: Document usage and repository constraints

**Files:**
- Create: `README.md`
- Modify: `AGENTS.md`

**Step 1: Write the failing test**

No automated test required for documentation-only work.

**Step 2: Run validation**

Verify the README matches the actual scripts and paths present in the repo.

**Step 3: Write minimal implementation**

Document setup, scope, architecture, and the Zotero 8/9 baseline.

**Step 4: Run validation**

Run: `npm test`
Expected: still PASS.

**Step 5: Commit**

Commit after docs reflect the current scaffold accurately.
