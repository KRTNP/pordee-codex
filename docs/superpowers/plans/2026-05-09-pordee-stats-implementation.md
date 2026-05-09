# Pordee Stats Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/pordee stats` with session and lifetime usage counters plus benchmark-based estimated token savings, without claiming exact end-to-end telemetry.

**Architecture:** Introduce shared stats helpers under `core/` that manage a separate stats file, built-in benchmark constants, and text rendering. Extend command parsing so adapters can distinguish stats commands from toggle commands. Claude and Codex adapters stay thin: they update counters on observed events, respond to stats commands, and otherwise preserve current behavior.

**Tech Stack:** Node.js CommonJS, file-based JSON persistence, Node test runner

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `core/pordee-state.js` | Shared path resolution, extended with stats file path support |
| `core/pordee-triggers.js` | Parse toggle commands and stats commands separately |
| `core/pordee-stats.js` | Stats store, benchmark constants, counter updates, session lifecycle |
| `core/pordee-render.js` | Render human-readable stats summary text |
| `adapters/claude/pordee-activate.js` | Start/reset session stats on Claude session start |
| `adapters/claude/pordee-mode-tracker.js` | Handle `/pordee stats`, update counters for toggles and active prompts |
| `adapters/codex/pordee-codex.js` | Handle `/pordee stats`, update counters for toggles and active prompts |
| `tests/test_core_state.js` | Verify stats path resolution if added there |
| `tests/test_core_triggers.js` | Verify stats command parsing |
| `tests/test_core_stats.js` | New shared stats behavior coverage |
| `tests/test_tracker.js` | Claude stats command + active prompt counter behavior |
| `tests/test_codex_adapter.js` | Codex stats command + counter behavior |
| `README.md` | Document stats command and estimated nature of savings |

### Task 1: Add shared stats core and parsing support

**Files:**
- Modify: `core/pordee-state.js`
- Modify: `core/pordee-triggers.js`
- Create: `core/pordee-stats.js`
- Modify: `core/pordee-render.js`
- Create: `tests/test_core_stats.js`
- Modify: `tests/test_core_state.js`
- Modify: `tests/test_core_triggers.js`

- [ ] **Step 1: Extend path resolution to include stats file**

Add:

```js
globalStatsPath: path.join(stateBaseDir, 'stats.json')
```

to the object returned by `resolveStatePaths()`.

- [ ] **Step 2: Add explicit command parsing for stats vs toggles**

Keep `parseTrigger()` behavior for compatibility, but add a richer parser, for example:

```js
function parsePordeeCommand(prompt) {
  // returns:
  // { kind: 'stats' }
  // { kind: 'toggle', patch: { enabled: true, level: 'lite' } }
  // null
}
```

Support:

```text
/pordee stats
พอดีสถิติ
```

- [ ] **Step 3: Create shared stats store helpers**

In `core/pordee-stats.js`, add:

- stats file read/write helpers
- default lifetime/session shapes
- `beginSession()`
- `recordToggle()`
- `recordActivePrompt()`
- benchmark constants for lite/full estimated saved tokens
- `getStatsSummary()` or equivalent data builder

Use deterministic benchmark constants rather than live output telemetry.

- [ ] **Step 4: Add stats rendering**

Add a renderer in `core/pordee-render.js`, for example:

```js
function renderStatsSummary(summary) {
  return [
    'pordee stats',
    `session: ${summary.session.activePromptCount} active prompts, ${summary.session.toggles} toggles, est. ${summary.session.estimatedTokensSaved} tokens saved`,
    `lifetime: ${summary.lifetime.activePromptCount} active prompts, ${summary.lifetime.toggles} toggles, est. ${summary.lifetime.estimatedTokensSaved} tokens saved`,
    `benchmark: lite ${summary.benchmark.liteSavingsPct}% avg, full ${summary.benchmark.fullSavingsPct}% avg across built-in samples`
  ].join('\n');
}
```

- [ ] **Step 5: Cover shared behavior with tests**

Add tests for:

- stats path resolution
- `/pordee stats` parsing
- `พอดีสถิติ` parsing
- session initialization
- toggle counting
- active prompt counting
- benchmark-based estimated savings increments

### Task 2: Wire stats into Claude and Codex adapters

**Files:**
- Modify: `adapters/claude/pordee-activate.js`
- Modify: `adapters/claude/pordee-mode-tracker.js`
- Modify: `adapters/codex/pordee-codex.js`
- Modify: `tests/test_tracker.js`
- Modify: `tests/test_codex_adapter.js`

- [ ] **Step 1: Initialize session stats in Claude SessionStart**

On Claude session start, call the shared `beginSession()` helper before checking enabled state.

- [ ] **Step 2: Handle stats commands before toggle flow in Claude tracker**

In `adapters/claude/pordee-mode-tracker.js`:

- parse the prompt with the richer command parser
- if it is a stats command, render stats and return it via `hookSpecificOutput.additionalContext`
- do not mutate pordee mode for stats commands

- [ ] **Step 3: Update Claude counters for observed usage**

Still in the tracker:

- increment toggle counters when a toggle command is used
- increment active prompt stats when pordee is enabled for a normal prompt

- [ ] **Step 4: Handle stats commands and counters in Codex adapter**

In `adapters/codex/pordee-codex.js`:

- if prompt is stats command, return a dedicated result such as:

```js
{ kind: 'stats', message: '...' }
```

- record toggle counters on toggle commands
- record active prompt stats when returning `kind: 'context'`

- [ ] **Step 5: Add adapter regression tests**

Add tests proving:

- Claude `/pordee stats` returns stats text
- Claude active prompts increment stats when enabled
- Codex `/pordee stats` returns stats result
- Codex active prompts increment stats when enabled

### Task 3: Document and verify the feature

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the stats command**

Add user-facing docs for:

```text
/pordee stats
```

and optional Thai alias if implemented.

- [ ] **Step 2: Document the limitation honestly**

State clearly that token savings are estimated from built-in benchmarks, not exact full telemetry for every historical reply.

- [ ] **Step 3: Run focused verification**

Run:

```bash
node --test tests/test_core_state.js tests/test_core_triggers.js tests/test_core_stats.js tests/test_tracker.js tests/test_codex_adapter.js
```

Expected: all suites pass with `0` failures.

- [ ] **Step 4: Run the full project test suite**

Run:

```bash
npm test
```

Expected: full suite passes with `0` failures.

- [ ] **Step 5: Inspect diff scope**

Run:

```bash
git status --short
git diff -- core adapters tests README.md
```

Expected: changes are limited to stats core, adapter integration, tests, and docs.
