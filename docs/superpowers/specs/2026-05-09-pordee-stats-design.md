# pordee Stats Command — Design Spec

**Date:** 2026-05-09
**Author:** Vatunyoo Suwannapisit
**Status:** Draft (pending implementation)

---

## 1. Overview

### 1.1 What

Add a `pordee stats` feature that reports:

- current session usage stats
- lifetime usage stats
- benchmark-based estimated token savings

in a style similar in spirit to `caveman`’s visible savings/stats positioning, but without falsely claiming exact telemetry the repo does not currently capture.

### 1.2 Why

Right now `pordee` claims token reduction ranges in docs and skill rules, but it does not expose any built-in visibility into:

- how often users actually run `pordee`
- how many prompts were handled while `pordee` was active
- what estimated savings look like over time

This makes the value proposition weaker and makes it harder for users to trust the compression claims.

### 1.3 Goals

- Add a user-facing stats command:
  - `/pordee stats`
  - Thai alias allowed if low-cost to support
- Track both session and lifetime counters
- Show estimated token savings grounded in repeatable benchmark logic
- Avoid overstating precision when no full reply telemetry exists
- Reuse existing state/trigger surfaces where possible

### 1.4 Non-goals

- No full per-reply telemetry capture across all platforms
- No external analytics service
- No network dependency
- No repo-level stats override in v1
- No attempt to reconstruct exact historical token usage

---

## 2. User Experience

### 2.1 Command surface

Primary command:

```text
/pordee stats
```

Optional Thai alias:

```text
พอดีสถิติ
```

Recommended: support both if implementation cost is small.

### 2.2 Output shape

The command should return a compact text summary, not JSON.

Example shape:

```text
pordee stats
session: 14 active prompts, 3 toggles, est. 420 tokens saved
lifetime: 188 active prompts, 44 toggles, est. 6120 tokens saved
benchmark: lite 41% avg, full 68% avg across built-in samples
```

### 2.3 Precision language

The output must explicitly distinguish:

- tracked counters
- estimated token savings
- benchmark averages

It must not imply:

- exact real output token accounting
- exact billing savings
- exact token counts for every historical response

---

## 3. Data Model

### 3.1 Separate stats store

Stats must live separately from state.

Global path:

```text
~/.pordee/stats.json
```

When `PORDEE_HOME` is set for tests/dev, stats should live under that root consistently, analogous to existing state handling.

### 3.2 Lifetime stats fields

Minimum lifetime fields:

- `version`
- `createdAt`
- `updatedAt`
- `toggles`
- `enableCount`
- `disableCount`
- `liteCount`
- `fullCount`
- `activePromptCount`
- `estimatedTokensSaved`

### 3.3 Session stats fields

Session stats are runtime-scoped, not persisted forever as a separate file history.

Recommended design:

- keep a `currentSession` object inside stats file
- identify session by `sessionStartedAt`
- reset when a new session begins

Minimum session fields:

- `sessionStartedAt`
- `toggles`
- `enableCount`
- `disableCount`
- `liteCount`
- `fullCount`
- `activePromptCount`
- `estimatedTokensSaved`

### 3.4 Benchmark profile fields

The stats system also needs baseline benchmark data:

- `liteAverageSavingsPct`
- `fullAverageSavingsPct`
- `sampleCount`

This benchmark data may be computed from fixtures or stored as generated constants.

---

## 4. Measurement Model

### 4.1 Two kinds of numbers

The feature reports two distinct classes of data:

1. **Tracked usage counters**
   - exact within the limits of the integration points we control
2. **Estimated token savings**
   - derived from benchmark averages, not from exact assistant-output token capture

### 4.2 How estimated savings work

For v1:

- each active prompt increments `activePromptCount`
- the current effective `level` determines which benchmark savings rate applies
- stats estimate saved tokens using a benchmark-derived average savings model

Example concept:

- assume `full` saves `68%` on average
- estimate original output size using a configured baseline token estimate per active prompt, or a benchmark-derived delta model

Recommended simpler design:

- maintain `estimatedTokensSaved` using a per-level average saved-token delta from built-in benchmark fixtures
- not a percentage-only display

This avoids pretending we know the user’s exact original output length for every turn.

### 4.3 Benchmark source

Use built-in benchmark samples from this repo, not live user data.

At minimum the benchmark set should cover:

- technical explanation
- bug explanation
- everyday non-technical explanation

The benchmark pipeline may be lightweight in v1, but the source samples must be explicit and versioned in repo.

### 4.4 Token counting

If feasible in local Node without undue dependency weight, use a real tokenizer library.

If adding a tokenizer dependency is too heavy for v1, use a deterministic fallback estimator and label the result as estimated.

Recommended priority:

1. real tokenizer if dependency cost is acceptable
2. deterministic estimator only if clearly documented as estimate

---

## 5. Integration Points

### 5.1 Trigger handling

Existing trigger surfaces already detect:

- `/pordee`
- `/pordee lite`
- `/pordee full`
- `/pordee stop`
- Thai keyword toggles

Stats should increment:

- toggle counters on enable/disable commands
- lite/full counters on level activation

### 5.2 Active prompt accounting

When a normal prompt arrives and `pordee` is enabled:

- increment `activePromptCount`
- increment `estimatedTokensSaved` using current effective level

This should happen in both:

- Claude adapter flow
- Codex adapter flow

where technically possible within the current architecture.

### 5.3 Session lifecycle

Claude has a natural `SessionStart` hook.

Codex may not expose exactly the same boundary in the current shipped local bundle path.

V1 design should therefore:

- reset/create `currentSession` at first observed usage after process/session start where needed
- use `SessionStart` when available on Claude
- keep behavior consistent enough that session stats are useful, even if session boundaries are adapter-defined

---

## 6. Files and Boundaries

### 6.1 Shared core

Add shared stats helpers under `core/`, not inside one adapter.

Expected responsibilities:

- read/write stats file
- initialize/reset session stats
- increment counters
- expose stats summary rendering helpers

### 6.2 Adapter usage

Adapters remain thin:

- Claude adapter updates stats on prompt/trigger events and returns stats text on stats command
- Codex adapter updates stats similarly and returns a trigger-like response for stats command

### 6.3 Fixtures

Benchmark samples should live in repo as dedicated fixtures/data, not hidden in docs prose.

---

## 7. Risks

### 7.1 Overclaiming accuracy

Biggest risk is presenting estimates as exact token savings.

Mitigation:

- use `est.` / `estimated`
- separate benchmark averages from tracked counters
- avoid money claims

### 7.2 Session boundary ambiguity

Session definitions differ by adapter.

Mitigation:

- define session as adapter-local usage window in v1
- document that lifetime numbers are stronger than session numbers

### 7.3 Dependency bloat

Adding a tokenizer library may be heavier than warranted.

Mitigation:

- prefer small dependency only if clearly justified
- otherwise ship deterministic estimator and document limitation

### 7.4 Hook-side noise

Stats command must not accidentally mutate pordee mode in unintended ways or spam reminders.

Mitigation:

- treat stats as a command branch before normal trigger/state reminder flow

---

## 8. Decision

Proceed with a `pordee stats` v1 that:

- supports `/pordee stats`
- optionally supports `พอดีสถิติ`
- tracks exact usage counters we can observe
- reports benchmark-based estimated token savings
- stores global lifetime stats plus current-session stats
- uses shared core stats helpers and thin adapter integrations
- avoids claiming exact end-to-end token telemetry
