# Pordee for Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Codex support to `pordee` with persistent state, trigger parsing, global + repo override resolution, and zero regression for existing Claude behavior.

**Architecture:** Extract platform-neutral state, trigger, and render helpers into `core/`, then refactor Claude hooks to consume them. Add a small Codex adapter layer in `codex/` that resolves effective state, handles trigger prompts, and returns activation context from the canonical `skills/pordee/SKILL.md` rules.

**Tech Stack:** Node.js CommonJS, built-in `node:test`, built-in `fs`/`path`/`os`, existing Markdown skill docs.

---

## File Structure

| Path | Responsibility |
|---|---|
| `core/pordee-state.js` | Shared defaults, file path resolution, read/write helpers, precedence merge |
| `core/pordee-triggers.js` | Shared trigger parsing and code-fence stripping |
| `core/pordee-render.js` | Shared activation / reminder text for Claude and Codex |
| `codex/pordee-codex.js` | Codex-facing runtime adapter |
| `tests/test_core_state.js` | Shared state resolution tests |
| `tests/test_core_triggers.js` | Shared trigger parser tests |
| `tests/test_core_render.js` | Shared render output tests |
| `tests/test_codex_adapter.js` | Codex adapter tests |
| `hooks/pordee-config.js` | Thin compatibility wrapper around shared state helpers |
| `hooks/pordee-mode-tracker.js` | Claude hook switched to shared trigger/state/render helpers |
| `hooks/pordee-activate.js` | Claude hook switched to shared state/render helpers |
| `README.md` | Codex support usage docs |

---

### Task 1: Build shared state core

**Files:**
- Create: `core/pordee-state.js`
- Create: `tests/test_core_state.js`
- Modify: `hooks/pordee-config.js`
- Test: `tests/test_core_state.js`

- [ ] **Step 1: Write the failing tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-core-'));
  return {
    root,
    globalHome: path.join(root, 'global-home'),
    repoRoot: path.join(root, 'repo')
  };
}

test('resolveStatePaths returns global and repo paths', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const env = makeEnv();
  const paths = resolveStatePaths({ homeDir: env.globalHome, repoRoot: env.repoRoot });
  assert.equal(paths.globalStatePath, path.join(env.globalHome, '.pordee', 'state.json'));
  assert.equal(paths.repoStatePath, path.join(env.repoRoot, '.pordee', 'state.json'));
});

test('getEffectiveState prefers repo override over global', () => {
  const { writeState, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  writeState(path.join(env.globalHome, '.pordee', 'state.json'), { enabled: true, level: 'full' });
  writeState(path.join(env.repoRoot, '.pordee', 'state.json'), { enabled: true, level: 'lite' });
  const state = getEffectiveState({ homeDir: env.globalHome, repoRoot: env.repoRoot });
  assert.equal(state.level, 'lite');
});

test('getEffectiveState falls back when repo JSON malformed', () => {
  const { writeState, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  const repoStatePath = path.join(env.repoRoot, '.pordee', 'state.json');
  writeState(path.join(env.globalHome, '.pordee', 'state.json'), { enabled: true, level: 'full' });
  fs.mkdirSync(path.dirname(repoStatePath), { recursive: true });
  fs.writeFileSync(repoStatePath, '{bad json');
  const state = getEffectiveState({ homeDir: env.globalHome, repoRoot: env.repoRoot });
  assert.equal(state.enabled, true);
  assert.equal(state.level, 'full');
});

test('writeScopedState writes global by default when no repo override exists', () => {
  const { writeScopedState, resolveStatePaths } = require('../core/pordee-state.js');
  const env = makeEnv();
  writeScopedState({ homeDir: env.globalHome, repoRoot: env.repoRoot }, { enabled: true, level: 'full' });
  const paths = resolveStatePaths({ homeDir: env.globalHome, repoRoot: env.repoRoot });
  assert.ok(fs.existsSync(paths.globalStatePath));
  assert.ok(!fs.existsSync(paths.repoStatePath));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/test_core_state.js`

Expected: FAIL with `Cannot find module '../core/pordee-state.js'`

- [ ] **Step 3: Write minimal shared state implementation**

```javascript
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STATE = Object.freeze({ enabled: false, level: 'full', version: 1 });
const VALID_LEVELS = new Set(['lite', 'full']);

function resolveStatePaths({ homeDir, repoRoot } = {}) {
  const baseHome = homeDir || os.homedir();
  return {
    globalStatePath: path.join(baseHome, '.pordee', 'state.json'),
    repoStatePath: repoRoot ? path.join(repoRoot, '.pordee', 'state.json') : null,
    errorLogPath: path.join(baseHome, '.pordee', 'error.log')
  };
}

function normalizeState(raw) {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_STATE.enabled,
    level: VALID_LEVELS.has(raw?.level) ? raw.level : DEFAULT_STATE.level,
    version: typeof raw?.version === 'number' ? raw.version : DEFAULT_STATE.version,
    lastChanged: raw?.lastChanged || undefined
  };
}

function readState(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { ...DEFAULT_STATE };
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(filePath, patch) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const merged = normalizeState({ ...readState(filePath), ...patch, version: 1, lastChanged: new Date().toISOString() });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
  fs.renameSync(tmpPath, filePath);
  return merged;
}

function getEffectiveState({ homeDir, repoRoot } = {}) {
  const paths = resolveStatePaths({ homeDir, repoRoot });
  const globalState = readState(paths.globalStatePath);
  const repoState = paths.repoStatePath && fs.existsSync(paths.repoStatePath)
    ? readState(paths.repoStatePath)
    : null;
  return repoState ? normalizeState({ ...globalState, ...repoState }) : globalState;
}

function writeScopedState({ homeDir, repoRoot } = {}, patch) {
  const paths = resolveStatePaths({ homeDir, repoRoot });
  const target = paths.repoStatePath && fs.existsSync(paths.repoStatePath)
    ? paths.repoStatePath
    : paths.globalStatePath;
  return writeState(target, patch);
}

module.exports = { DEFAULT_STATE, VALID_LEVELS, resolveStatePaths, normalizeState, readState, writeState, getEffectiveState, writeScopedState };
```

- [ ] **Step 4: Refactor Claude config wrapper to use shared state core**

```javascript
#!/usr/bin/env node
const fs = require('node:fs');
const { DEFAULT_STATE, VALID_LEVELS, resolveStatePaths, readState, writeScopedState } = require('../core/pordee-state');

const HOME_DIR = process.env.PORDEE_HOME || require('node:path').join(require('node:os').homedir(), '.pordee');
const { globalStatePath: STATE_PATH, errorLogPath: ERROR_LOG_PATH } = resolveStatePaths({ homeDir: HOME_DIR.replace(/\/\.pordee$/, '') });

function logError(msg) {
  try {
    fs.mkdirSync(require('node:path').dirname(ERROR_LOG_PATH), { recursive: true });
    fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

function getState() {
  return readState(STATE_PATH);
}

function setState(patch) {
  try {
    return writeScopedState({ homeDir: HOME_DIR.replace(/\/\.pordee$/, '') }, patch);
  } catch (e) {
    logError(`setState: ${e.message}`);
    return null;
  }
}

module.exports = { STATE_PATH, ERROR_LOG_PATH, DEFAULT_STATE, VALID_LEVELS, getState, setState, logError };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test_core_state.js tests/test_state.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/pordee-state.js tests/test_core_state.js hooks/pordee-config.js tests/test_state.js
git commit -m "refactor: extract shared pordee state core"
```

### Task 2: Build shared trigger core

**Files:**
- Create: `core/pordee-triggers.js`
- Create: `tests/test_core_triggers.js`
- Modify: `hooks/pordee-mode-tracker.js`
- Test: `tests/test_core_triggers.js`

- [ ] **Step 1: Write the failing tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('parseTrigger handles slash commands', () => {
  const { parseTrigger } = require('../core/pordee-triggers.js');
  assert.deepEqual(parseTrigger('/pordee lite'), { enabled: true, level: 'lite' });
  assert.deepEqual(parseTrigger('/pordee stop'), { enabled: false });
});

test('parseTrigger handles Thai enable and disable phrases', () => {
  const { parseTrigger } = require('../core/pordee-triggers.js');
  assert.deepEqual(parseTrigger('พอดี'), { enabled: true });
  assert.deepEqual(parseTrigger('พูดปกติ'), { enabled: false });
});

test('parseTrigger ignores fenced code blocks', () => {
  const { parseTrigger } = require('../core/pordee-triggers.js');
  assert.equal(parseTrigger('```\n/pordee full\n```'), null);
});

test('parseTrigger ignores unknown subcommand', () => {
  const { parseTrigger } = require('../core/pordee-triggers.js');
  assert.equal(parseTrigger('/pordee weird'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/test_core_triggers.js`

Expected: FAIL with `Cannot find module '../core/pordee-triggers.js'`

- [ ] **Step 3: Write minimal shared trigger implementation**

```javascript
function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*$/, '');
}

function parseTrigger(prompt) {
  const cleaned = stripCodeFences(String(prompt || ''));
  const trimmed = cleaned.trim();
  const slashMatch = trimmed.match(/^\/pordee(?:\s+(\w+))?$/i);
  if (slashMatch) {
    const arg = (slashMatch[1] || '').toLowerCase();
    if (arg === 'lite') return { enabled: true, level: 'lite' };
    if (arg === 'full') return { enabled: true, level: 'full' };
    if (arg === 'stop') return { enabled: false };
    if (arg === '') return { enabled: true };
    return null;
  }
  for (const phrase of ['หยุดพอดี', 'พูดปกติ']) {
    if (trimmed === phrase) return { enabled: false };
  }
  for (const phrase of ['พอดีโหมด', 'พูดสั้นๆ', 'พอดี']) {
    if (trimmed === phrase) return { enabled: true };
  }
  return null;
}

module.exports = { stripCodeFences, parseTrigger };
```

- [ ] **Step 4: Refactor Claude prompt hook to use shared trigger helper**

```javascript
const { getState, setState, logError } = require('./pordee-config');
const { parseTrigger } = require('../core/pordee-triggers');
const { renderPromptReminder } = require('../core/pordee-render');

function emitActiveReminder(state) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: renderPromptReminder(state)
    }
  }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test_core_triggers.js tests/test_triggers.js tests/test_tracker.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/pordee-triggers.js tests/test_core_triggers.js hooks/pordee-mode-tracker.js tests/test_triggers.js tests/test_tracker.js
git commit -m "refactor: extract shared pordee trigger parser"
```

### Task 3: Build shared render core

**Files:**
- Create: `core/pordee-render.js`
- Create: `tests/test_core_render.js`
- Modify: `hooks/pordee-activate.js`
- Modify: `hooks/pordee-mode-tracker.js`
- Modify: `tests/test_activate.js`
- Modify: `tests/test_tracker.js`
- Test: `tests/test_activate.js`

- [ ] **Step 1: Write the failing tests for shared render output**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('renderSessionContext includes level and persistence rules', () => {
  const { renderSessionContext } = require('../core/pordee-render.js');
  const text = renderSessionContext({ enabled: true, level: 'lite' });
  assert.match(text, /PORDEE MODE ACTIVE/);
  assert.match(text, /level: lite/);
  assert.match(text, /Off only via "หยุดพอดี"/);
});

test('renderPromptReminder returns single-line reminder', () => {
  const { renderPromptReminder } = require('../core/pordee-render.js');
  const text = renderPromptReminder({ enabled: true, level: 'full' });
  assert.match(text, /PORDEE MODE ACTIVE \(full\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/test_core_render.js`

Expected: FAIL with `Cannot find module '../core/pordee-render.js'`

- [ ] **Step 3: Add render helper and companion test file**

```javascript
function normalizeLevel(level) {
  return level === 'lite' ? 'lite' : 'full';
}

function renderSessionContext(state) {
  const level = normalizeLevel(state?.level);
  return `PORDEE MODE ACTIVE — level: ${level}\n\n` +
    'Respond terse like simple Thai. Keep technical English terms. ' +
    'Drop polite particles (ครับ, ค่ะ, นะคะ, นะครับ), hedging (อาจจะ, น่าจะ, จริงๆแล้ว), ' +
    'pleasantries (ได้เลยครับ, แน่นอน), and English-style filler (just/really/basically/actually/simply). ' +
    'Fragments OK. Use short Thai synonyms (ดู not ตรวจสอบ, แก้ not ทำการแก้ไข, เพราะ not เนื่องจาก).\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift. Off only via "หยุดพอดี", "พูดปกติ", or "/pordee stop".\n\n' +
    `Current level: **${level}**. Switch: \`/pordee lite|full\`.\n`;
}

function renderPromptReminder(state) {
  const level = normalizeLevel(state?.level);
  return `PORDEE MODE ACTIVE (${level}). ตอบไทยกระชับ. Keep technical English terms. Drop polite particles, hedging, pleasantries. Fragments OK. Code/commits/security: write normal.`;
}

module.exports = { normalizeLevel, renderSessionContext, renderPromptReminder };
```

- [ ] **Step 4: Switch both Claude hooks to use shared render functions**

```javascript
const { getState } = require('./pordee-config');
const { renderSessionContext } = require('../core/pordee-render');

const state = getState();
if (state.enabled) {
  process.stdout.write(renderSessionContext(state));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test_core_render.js tests/test_activate.js tests/test_tracker.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/pordee-render.js tests/test_core_render.js hooks/pordee-activate.js hooks/pordee-mode-tracker.js tests/test_activate.js tests/test_tracker.js
git commit -m "refactor: share pordee activation text"
```

### Task 4: Add Codex adapter

**Files:**
- Create: `codex/pordee-codex.js`
- Create: `tests/test_codex_adapter.js`
- Test: `tests/test_codex_adapter.js`

- [ ] **Step 1: Write the failing Codex adapter tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-codex-'));
  return { homeDir: path.join(root, 'home'), repoRoot: path.join(root, 'repo') };
}

test('handlePrompt updates state for trigger prompt', () => {
  const { handlePrompt } = require('../codex/pordee-codex.js');
  const env = makeEnv();
  const result = handlePrompt({ prompt: '/pordee lite', homeDir: env.homeDir, repoRoot: env.repoRoot });
  assert.equal(result.kind, 'trigger');
  assert.equal(result.message, 'pordee lite active');
});

test('handlePrompt returns inactive when state disabled', () => {
  const { handlePrompt } = require('../codex/pordee-codex.js');
  const env = makeEnv();
  const result = handlePrompt({ prompt: 'explain project', homeDir: env.homeDir, repoRoot: env.repoRoot });
  assert.equal(result.kind, 'pass');
});

test('handlePrompt returns context when state enabled', () => {
  const { writeScopedState } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../codex/pordee-codex.js');
  const env = makeEnv();
  writeScopedState({ homeDir: env.homeDir, repoRoot: env.repoRoot }, { enabled: true, level: 'full' });
  const result = handlePrompt({ prompt: 'regular prompt', homeDir: env.homeDir, repoRoot: env.repoRoot });
  assert.equal(result.kind, 'context');
  assert.match(result.additionalContext, /PORDEE MODE ACTIVE/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/test_codex_adapter.js`

Expected: FAIL with `Cannot find module '../codex/pordee-codex.js'`

- [ ] **Step 3: Implement minimal Codex adapter**

```javascript
const { getEffectiveState, writeScopedState } = require('../core/pordee-state');
const { parseTrigger } = require('../core/pordee-triggers');
const { renderSessionContext } = require('../core/pordee-render');

function handlePrompt({ prompt, homeDir, repoRoot }) {
  const trigger = parseTrigger(prompt);
  if (trigger) {
    const next = writeScopedState({ homeDir, repoRoot }, trigger);
    const level = next?.level === 'lite' ? 'lite' : 'full';
    return trigger.enabled === false
      ? { kind: 'trigger', message: 'pordee off', state: next }
      : { kind: 'trigger', message: `pordee ${level} active`, state: next };
  }

  const state = getEffectiveState({ homeDir, repoRoot });
  if (!state.enabled) return { kind: 'pass', state };

  return {
    kind: 'context',
    state,
    additionalContext: renderSessionContext(state)
  };
}

module.exports = { handlePrompt };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test_codex_adapter.js tests/test_core_state.js tests/test_core_triggers.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add codex/pordee-codex.js tests/test_codex_adapter.js
git commit -m "feat: add codex pordee adapter"
```

### Task 5: Preserve Claude compatibility after refactor

**Files:**
- Modify: `hooks/pordee-config.js`
- Modify: `hooks/pordee-mode-tracker.js`
- Modify: `hooks/pordee-activate.js`
- Modify: `tests/test_state.js`
- Modify: `tests/test_tracker.js`
- Modify: `tests/test_activate.js`
- Modify: `tests/test_triggers.js`
- Test: `tests/test_state.js`, `tests/test_tracker.js`, `tests/test_activate.js`, `tests/test_triggers.js`

- [ ] **Step 1: Update failing regression assertions for new shared imports only if needed**

```javascript
test('tracker emits hookSpecificOutput JSON when pordee enabled', () => {
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(parsed.hookSpecificOutput.additionalContext, /PORDEE MODE ACTIVE/);
});
```

- [ ] **Step 2: Run Claude regression suite**

Run: `node --test tests/test_state.js tests/test_tracker.js tests/test_activate.js tests/test_triggers.js`

Expected: FAIL only where refactor changed import or path assumptions

- [ ] **Step 3: Fix wrapper and hook compatibility issues**

```javascript
module.exports = {
  STATE_PATH,
  ERROR_LOG_PATH,
  DEFAULT_STATE,
  VALID_LEVELS,
  getState,
  setState,
  logError
};
```

Keep exported names unchanged so all existing tests and Claude integration continue to work.

- [ ] **Step 4: Re-run Claude regression suite**

Run: `node --test tests/test_state.js tests/test_tracker.js tests/test_activate.js tests/test_triggers.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/pordee-config.js hooks/pordee-mode-tracker.js hooks/pordee-activate.js tests/test_state.js tests/test_tracker.js tests/test_activate.js tests/test_triggers.js
git commit -m "test: preserve claude hook compatibility"
```

### Task 6: Document Codex usage

**Files:**
- Modify: `README.md`
- Test: manual doc review

- [ ] **Step 1: Add Codex support section to README**

```md
## ใช้กับ Codex

`pordee` รองรับ Codex แบบ v1 ผ่าน shared core + Codex adapter

รองรับ trigger:

- `/pordee`
- `/pordee lite`
- `/pordee full`
- `/pordee stop`
- `พอดี`
- `พอดีโหมด`
- `พูดสั้นๆ`
- `หยุดพอดี`
- `พูดปกติ`

State precedence:

- global: `~/.pordee/state.json`
- repo override: `<repo>/.pordee/state.json`
- effective config = repo override > global > defaults
```

- [ ] **Step 2: Add examples for global default vs repo override**

```md
### Scope ของ state

- ถ้า repo ยังไม่มี `.pordee/state.json` → trigger จะเขียน global state
- ถ้า repo มี `.pordee/state.json` อยู่แล้ว → trigger จะเขียน repo override
```

- [ ] **Step 3: Review README formatting**

Run: `sed -n '1,260p' README.md`

Expected: Codex section present, Thai wording consistent, no duplicate trigger table

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add codex usage guide"
```

### Task 7: Run full verification

**Files:**
- Modify: none
- Test: `tests/test_*.js`

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all `tests/test_*.js` PASS

- [ ] **Step 2: Run focused Codex verification**

Run: `node --test tests/test_core_state.js tests/test_core_triggers.js tests/test_core_render.js tests/test_codex_adapter.js`

Expected: PASS

- [ ] **Step 3: Check git diff for unexpected changes**

Run: `git status --short`

Expected: only intended implementation files modified

- [ ] **Step 4: Commit final verification state**

```bash
git add core codex hooks tests README.md
git commit -m "feat: support pordee state and triggers in codex"
```

---

## Self-Review

### Spec coverage

- Shared core extraction: Task 1, 2, 3
- Claude compatibility: Task 5
- Codex adapter: Task 4
- Global + repo override precedence: Task 1, Task 4
- Trigger set and matching rules: Task 2
- README documentation: Task 6
- Verification: Task 7

No uncovered spec section remains.

### Placeholder scan

- No `TODO` / `TBD`
- All file paths explicit
- All test commands explicit
- All commits explicit

### Type consistency

- Shared core names used consistently:
  - `getEffectiveState`
  - `writeScopedState`
  - `parseTrigger`
  - `renderSessionContext`
  - `renderPromptReminder`
  - `handlePrompt`
