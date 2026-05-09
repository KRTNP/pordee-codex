# pordee Adapter Path Refactor — Design Spec

**Date:** 2026-05-09
**Author:** Vatunyoo Suwannapisit
**Status:** Draft (pending implementation)

---

## 1. Overview

### 1.1 What

Refactor platform-specific source paths so adapter code lives under a consistent top-level `adapters/` directory.

Current structure mixes:

- `hooks/` for Claude
- `codex/` for Codex

Target structure:

- `adapters/claude/`
- `adapters/codex/`

### 1.2 Why

Current naming is asymmetric. `hooks/` describes an implementation detail of one adapter, while `codex/` describes a platform. That makes the source tree harder to scan and leaves no clean pattern for future platforms.

This refactor makes the runtime boundaries explicit:

- `core/` = shared logic
- `adapters/claude/` = Claude-specific integration
- `adapters/codex/` = Codex-specific integration
- `plugins/pordee/` = packaged install artifact

### 1.3 Goals

- Rename source-side adapter directories only
- Preserve current behavior exactly
- Update all imports, test paths, and manifest references
- Keep packaged plugin/install flow working

### 1.4 Non-goals

- No logic changes
- No new features
- No packaging redesign
- No refactor of `plugins/pordee/`
- No refactor of `core/`

---

## 2. Proposed Structure

### 2.1 Current

```text
core/
hooks/
codex/
plugins/pordee/
```

### 2.2 Target

```text
core/
adapters/
  claude/
  codex/
plugins/pordee/
```

### 2.3 File moves

```text
hooks/pordee-config.js       -> adapters/claude/pordee-config.js
hooks/pordee-activate.js     -> adapters/claude/pordee-activate.js
hooks/pordee-mode-tracker.js -> adapters/claude/pordee-mode-tracker.js
codex/pordee-codex.js        -> adapters/codex/pordee-codex.js
```

---

## 3. Required Updates

### 3.1 Claude plugin manifest

Update `.claude-plugin/plugin.json` so hook commands point to:

- `adapters/claude/pordee-activate.js`
- `adapters/claude/pordee-mode-tracker.js`

### 3.2 Source imports

Update relative imports inside moved files so they still resolve:

- Claude adapter files must continue to import from `core/`
- tests must import the new adapter paths
- any docs or examples referencing old source paths must be updated if they are meant to stay accurate

### 3.3 Tests

Tests that currently build adapter paths from `hooks/` or `codex/` must be updated to:

- `adapters/claude/...`
- `adapters/codex/...`

---

## 4. Safety Constraints

- This is a path-only refactor
- Runtime behavior before and after should be identical
- Existing passing suites must still pass:
  - Claude tests
  - Codex adapter tests
  - installer tests

If any test requires behavior changes to pass, that is out of scope and should stop the refactor for review.

---

## 5. Risks

### 5.1 Broken relative imports

Moving files changes import depth. This is the most likely breakage.

Mitigation:

- update every moved file and every test import together
- run full suite after refactor

### 5.2 Stale manifest paths

Claude plugin manifest still pointing at `hooks/...` would break Claude integration immediately.

Mitigation:

- update `.claude-plugin/plugin.json` in the same change

### 5.3 Stale docs

README or specs may still mention old source paths.

Mitigation:

- update only user-facing docs that are meant to reflect current source layout
- do not mass-edit historical docs unless necessary

---

## 6. Decision

Proceed with a path-only refactor to:

- `adapters/claude/`
- `adapters/codex/`

and update manifests, imports, and tests accordingly, with no behavior changes.
