# Pordee Adapter Path Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Claude and Codex source-side adapter files under a consistent `adapters/` tree without changing behavior.

**Architecture:** This is a path-only refactor. Shared logic stays in `core/`, Claude integration moves from `hooks/` to `adapters/claude/`, Codex integration moves from `codex/` to `adapters/codex/`, and packaged artifacts under `plugins/pordee/` remain unchanged. The refactor succeeds only if manifests, imports, and tests all resolve the new paths with no runtime behavior changes.

**Tech Stack:** Node.js CommonJS, Claude plugin manifest JSON, Node test runner

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `adapters/claude/pordee-config.js` | Claude adapter wrapper around shared state helpers |
| `adapters/claude/pordee-activate.js` | Claude `SessionStart` activation hook |
| `adapters/claude/pordee-mode-tracker.js` | Claude `UserPromptSubmit` hook |
| `adapters/codex/pordee-codex.js` | Codex runtime adapter |
| `.claude-plugin/plugin.json` | Claude hook command paths |
| `tests/test_state.js` | Claude state wrapper path coverage |
| `tests/test_activate.js` | Claude activation hook coverage |
| `tests/test_tracker.js` | Claude prompt hook coverage |
| `tests/test_triggers.js` | Trigger parser + Claude wrapper regression coverage |
| `tests/test_codex_adapter.js` | Codex adapter path coverage |

### Task 1: Move adapter source files and update imports

**Files:**
- Create: `adapters/claude/pordee-config.js`
- Create: `adapters/claude/pordee-activate.js`
- Create: `adapters/claude/pordee-mode-tracker.js`
- Create: `adapters/codex/pordee-codex.js`
- Delete: `hooks/pordee-config.js`
- Delete: `hooks/pordee-activate.js`
- Delete: `hooks/pordee-mode-tracker.js`
- Delete: `codex/pordee-codex.js`

- [ ] **Step 1: Copy the existing adapter files into the new directories**

Copy the current implementations exactly, preserving behavior:

```text
hooks/pordee-config.js       -> adapters/claude/pordee-config.js
hooks/pordee-activate.js     -> adapters/claude/pordee-activate.js
hooks/pordee-mode-tracker.js -> adapters/claude/pordee-mode-tracker.js
codex/pordee-codex.js        -> adapters/codex/pordee-codex.js
```

- [ ] **Step 2: Update relative imports inside moved files**

Adjust import depth only:

```js
// adapters/claude/pordee-config.js
} = require('../../core/pordee-state');

// adapters/claude/pordee-activate.js
const { renderSessionContext } = require('../../core/pordee-render');

// adapters/claude/pordee-mode-tracker.js
const { parseTrigger } = require('../../core/pordee-triggers');
const { renderPromptReminder } = require('../../core/pordee-render');

// adapters/codex/pordee-codex.js
} = require('../../core/pordee-state.js');
const { parseTrigger } = require('../../core/pordee-triggers.js');
const { renderSessionContext } = require('../../core/pordee-render.js');
```

- [ ] **Step 3: Remove the old source files**

Delete the superseded paths only after the new files are in place:

```text
hooks/pordee-config.js
hooks/pordee-activate.js
hooks/pordee-mode-tracker.js
codex/pordee-codex.js
```

### Task 2: Update runtime references and test imports

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `tests/test_state.js`
- Modify: `tests/test_activate.js`
- Modify: `tests/test_tracker.js`
- Modify: `tests/test_triggers.js`
- Modify: `tests/test_codex_adapter.js`

- [ ] **Step 1: Update Claude manifest hook commands**

Point Claude to the new adapter paths:

```json
"command": "node \"${CLAUDE_PLUGIN_ROOT}/adapters/claude/pordee-activate.js\""
"command": "node \"${CLAUDE_PLUGIN_ROOT}/adapters/claude/pordee-mode-tracker.js\""
```

- [ ] **Step 2: Update all test imports that reference old adapter paths**

Replace path references only:

```js
require('../hooks/pordee-config.js');
// becomes
require('../adapters/claude/pordee-config.js');

require('../codex/pordee-codex.js');
// becomes
require('../adapters/codex/pordee-codex.js');
```

- [ ] **Step 3: Leave historical planning/spec docs unchanged**

Do not mass-edit old specs or plans that describe the repo at an earlier point in time. Only touch docs if a user-facing runtime path would become misleading in current usage instructions.

### Task 3: Verify no behavior changed

**Files:**
- Test: `tests/test_state.js`
- Test: `tests/test_activate.js`
- Test: `tests/test_tracker.js`
- Test: `tests/test_triggers.js`
- Test: `tests/test_codex_adapter.js`
- Test: `tests/test_codex_install.js`

- [ ] **Step 1: Run the focused adapter regression suite**

Run:

```bash
node --test tests/test_state.js tests/test_activate.js tests/test_tracker.js tests/test_triggers.js tests/test_codex_adapter.js tests/test_codex_install.js
```

Expected: all listed suites pass with `0` failures.

- [ ] **Step 2: Run the full project test suite**

Run:

```bash
npm test
```

Expected: full test suite passes with `0` failures.

- [ ] **Step 3: Inspect worktree for path-only scope**

Run:

```bash
git status --short
git diff -- adapters .claude-plugin tests
```

Expected: changes are limited to new `adapters/` paths, manifest updates, and test import rewrites; no functional drift outside refactor scope.
