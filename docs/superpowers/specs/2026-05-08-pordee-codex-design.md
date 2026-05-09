# pordee for Codex — Design Spec

**Date:** 2026-05-08
**Author:** Vatunyoo Suwannapisit
**Status:** Draft (pending implementation)

---

## 1. Overview

### 1.1 What

Add Codex support to `pordee` so it works beyond Claude-specific hooks. v1 for Codex must support:

- `pordee` style as a Codex skill/instruction source
- persistent mode state
- trigger phrases and slash-like text commands
- global state plus per-repo override

### 1.2 Why

Current repo is Claude-first. Core value of `pordee` is not Claude hooks; it is compressed Thai+English communication with stable behavior across turns. Codex support makes that core reusable on another agent platform without rebuilding the language rules.

### 1.3 Goals

- Preserve current `pordee` language behavior
- Keep existing Claude integration working
- Add Codex-specific activation path without duplicating rules
- Support these triggers in Codex:
  - `/pordee`
  - `/pordee lite`
  - `/pordee full`
  - `/pordee stop`
  - `พอดี`
  - `พอดีโหมด`
  - `พูดสั้นๆ`
  - `หยุดพอดี`
  - `พูดปกติ`
- Support state precedence: `repo override > global state > defaults`

### 1.4 Non-goals

- No attempt to perfectly reproduce Claude hook events in Codex
- No GUI, statusline badge, or MCP service
- No automatic cross-platform installer for Codex v1
- No new compression levels beyond existing `lite` and `full`
- No large rewrite into a shared npm package in this phase

---

## 2. Design Summary

Recommended approach: **shared core + Codex adapter**

- Keep `skills/pordee/SKILL.md` as source of truth for writing style
- Extract shared trigger/state logic into reusable modules
- Add a Codex-facing adapter that:
  - detects trigger-only prompts
  - updates state
  - resolves effective mode from global + repo config
  - emits short confirmation when mode changes
  - loads `pordee` instruction context when mode is enabled

This is intentionally smaller than a full multi-platform framework, but cleaner than bolting Codex logic directly into Claude-only files.

---

## 3. Architecture

### 3.1 Shared core

Create platform-neutral modules for:

- `state schema`
- `state file resolution`
- `state merge / precedence`
- `trigger parsing`
- `mode normalization`
- `activation message rendering`

These modules must not depend on Claude plugin paths or Claude hook payloads.

### 3.2 Claude adapter

Current files under `hooks/` remain Claude adapter layer:

- `hooks/pordee-config.js`
- `hooks/pordee-activate.js`
- `hooks/pordee-mode-tracker.js`

They should migrate to use shared core helpers instead of owning parsing/state logic directly.

### 3.3 Codex adapter

Add Codex-specific files that do not assume Claude plugin manifests.

Responsibilities:

- inspect current repo path
- resolve effective `pordee` state
- detect whether current user message is a trigger command
- if trigger:
  - update state
  - return short acknowledgement
- if enabled:
  - surface persistent `pordee` instruction text to Codex

### 3.4 Source of truth

`skills/pordee/SKILL.md` remains canonical for compression behavior. Codex adapter should reuse that text or a derived instruction block, not fork a second independent ruleset.

---

## 4. State Model

### 4.1 State shape

```json
{
  "enabled": true,
  "level": "full",
  "version": 1,
  "lastChanged": "2026-05-08T10:30:00.000Z"
}
```

Defaults:

```json
{
  "enabled": false,
  "level": "full",
  "version": 1
}
```

### 4.2 Storage locations

Global state:

- `~/.pordee/state.json`

Repo override:

- `<repo>/.pordee/state.json`

### 4.3 Precedence

Effective state resolution:

1. defaults
2. global state
3. repo override

Rules:

- `enabled` from repo overrides global
- `level` from repo overrides global
- malformed file falls back silently to lower-precedence source
- writes are atomic

### 4.4 Write behavior

Trigger command updates repo state when inside a repo that already has override file or when user explicitly chooses repo scope later. Otherwise write global state by default for v1.

Rationale:

- global default matches “mode follows me”
- repo override exists for team/project-specific behavior
- avoids surprising writes into every repo automatically

---

## 5. Trigger Behavior

### 5.1 Supported triggers

Slash-like:

- `/pordee`
- `/pordee lite`
- `/pordee full`
- `/pordee stop`

Thai:

- `พอดี`
- `พอดีโหมด`
- `พูดสั้นๆ`
- `หยุดพอดี`
- `พูดปกติ`

### 5.2 Matching rules

- input must match whole trimmed prompt
- case-insensitive for slash command
- exact text match for Thai phrases
- ignore triggers inside fenced code blocks
- disable triggers checked before enable triggers so `หยุดพอดี` never accidentally matches `พอดี`

### 5.3 Effects

- enable trigger:
  - `enabled = true`
  - `level` set if command specifies one
- disable trigger:
  - `enabled = false`
  - keep previous `level`
- bare `/pordee`:
  - enable using existing level, or `full` if unset

---

## 6. Codex Runtime Behavior

### 6.1 On normal prompt

If effective state says disabled:

- do nothing

If effective state says enabled:

- apply `pordee` compression instructions automatically for response generation

### 6.2 On trigger prompt

- parse trigger
- update state
- respond with short confirmation only

Examples:

- `/pordee` → `pordee full active`
- `/pordee lite` → `pordee lite active`
- `/pordee stop` → `pordee off`

### 6.3 Auto-clarity and boundaries

Codex support must preserve same safety boundaries already defined in `skills/pordee/SKILL.md`:

- destructive confirmations become normal language
- security warnings become normal language
- code blocks unchanged
- commit / PR / code review text stays normal English
- exact error strings stay exact

---

## 7. File Layout Changes

Proposed additions:

```text
core/
  pordee-state.js
  pordee-triggers.js
  pordee-render.js

codex/
  pordee-codex.js
  pordee-context.js

tests/
  test_core_state.js
  test_core_triggers.js
  test_codex_state_resolution.js
  test_codex_adapter.js
```

Proposed refactor:

- existing Claude hook files import shared `core/` helpers
- no behavior fork between Claude and Codex for parsing/state semantics

---

## 8. Error Handling

- missing state files: use defaults
- malformed JSON: log if possible, continue with lower-precedence/default state
- missing repo root: operate global-only
- unknown trigger subcommand: ignore, treat as normal prompt
- unsupported level: normalize to `full`

Codex integration must never fail closed in a way that blocks normal answering.

---

## 9. Testing

Required test coverage:

- global state read/write
- repo override read/write
- precedence merge behavior
- malformed global state fallback
- malformed repo state fallback
- slash trigger parsing
- Thai trigger parsing
- ignore trigger inside code fences
- disable precedence over substring match
- Codex adapter:
  - enabled mode auto-applies
  - trigger prompt updates state
  - disabled mode stays normal

Regression coverage:

- existing Claude hook tests still pass after refactor

---

## 10. Rollout Plan

Phase 1:

- extract shared core from Claude-specific files
- add Codex adapter
- add tests

Phase 2:

- document Codex usage in `README.md`
- add examples for global vs repo override

Phase 3:

- optional future cleanup into formal multi-platform package if both adapters stabilize

---

## 11. Risks

### 11.1 Instruction drift

If Codex adapter copies rules instead of reusing canonical skill text, Claude and Codex behavior will diverge.

Mitigation:

- one source of truth for rule text

### 11.2 Scope confusion for writes

If every trigger writes repo-local state automatically, users may accidentally create repo config files everywhere.

Mitigation:

- global by default
- repo override only when file already exists or future explicit repo-scope command added

### 11.3 Platform mismatch

Codex may not expose lifecycle identical to Claude hooks.

Mitigation:

- design around prompt-time resolution, not Claude event parity

---

## 12. Decision

Implement Codex support as **shared core + Codex adapter**, with:

- persistent state
- trigger commands
- global + repo override precedence
- `skills/pordee/SKILL.md` as canonical style definition

This is smallest design that gives real Codex support without locking the codebase deeper into Claude-only structure.
