# Pordee Skills Add Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Officially support `npx skills add` for the root `pordee` skill while preserving the existing Codex project-local plugin installer flow.

**Architecture:** Keep `skills/pordee/SKILL.md` as the canonical global-skill source for Codex and leave `plugins/pordee/` plus `install.sh` / `install.ps1` unchanged for project-local plugin installs. Add a verification test that enforces sync between the root skill and the packaged plugin copy, and update README to explain the two Codex installation modes clearly.

**Tech Stack:** Node.js CommonJS, Node test runner, Markdown docs

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `README.md` | User-facing install docs for Claude, Codex global skill, and Codex project-local plugin modes |
| `skills/pordee/SKILL.md` | Canonical pordee skill for global `npx skills add` installation |
| `plugins/pordee/skills/pordee/SKILL.md` | Packaged copy used by the project-local Codex plugin bundle |
| `tests/test_skill_sync.js` | Drift-prevention test between root and packaged skill copies |
| `package.json` | Test script picks up the new test file via existing `tests/test_*.js` glob |

### Task 1: Add sync verification for root and packaged skills

**Files:**
- Create: `tests/test_skill_sync.js`
- Modify: `plugins/pordee/skills/pordee/SKILL.md`

- [ ] **Step 1: Decide whether the packaged skill can be byte-identical**

Prefer removing the packaged preamble note so the files can match exactly:

```text
plugins/pordee/skills/pordee/SKILL.md
```

should contain the same content as:

```text
skills/pordee/SKILL.md
```

- [ ] **Step 2: Write the failing sync test**

Create `tests/test_skill_sync.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('packaged Codex skill stays in sync with root pordee skill', () => {
  const rootSkill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'pordee', 'SKILL.md'),
    'utf8'
  );
  const packagedSkill = fs.readFileSync(
    path.join(__dirname, '..', 'plugins', 'pordee', 'skills', 'pordee', 'SKILL.md'),
    'utf8'
  );

  assert.equal(packagedSkill, rootSkill);
});
```

- [ ] **Step 3: Run the sync test to verify the current drift**

Run:

```bash
node --test tests/test_skill_sync.js
```

Expected: FAIL because the packaged copy currently has an extra preamble line.

- [ ] **Step 4: Make the packaged skill match the root skill exactly**

Remove any packaging-only preamble from:

```text
plugins/pordee/skills/pordee/SKILL.md
```

so it matches `skills/pordee/SKILL.md` byte-for-byte.

- [ ] **Step 5: Run the sync test again**

Run:

```bash
node --test tests/test_skill_sync.js
```

Expected: PASS

### Task 2: Document the two Codex install modes clearly

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a dedicated Codex global skill install section**

Document the supported `npx skills add` path using the root skill:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<ref>/skills/pordee
```

Explain that this installs the global skill from:

```text
skills/pordee/SKILL.md
```

- [ ] **Step 2: Clarify that project-local plugin install remains separate**

Retain the existing installer commands:

```bash
./install.sh --project /path/to/project
```

```powershell
.\install.ps1 -Project C:\path\to\project
```

and explicitly explain:

- `npx skills add ...` = global skill install
- `install.sh --project ...` = project-local plugin install

- [ ] **Step 3: Explain the tradeoff in one concise comparison**

Add a short comparison table or bullets covering:

- what gets installed
- install scope
- when to choose each flow

### Task 3: Verify the new docs/test path and full suite

**Files:**
- Test: `tests/test_skill_sync.js`
- Test: `tests/test_codex_install.js`

- [ ] **Step 1: Run focused verification for the new behavior**

Run:

```bash
node --test tests/test_skill_sync.js tests/test_codex_install.js
```

Expected: both suites pass with `0` failures.

- [ ] **Step 2: Run the full project test suite**

Run:

```bash
npm test
```

Expected: full test suite passes with `0` failures.

- [ ] **Step 3: Inspect final diff for scope**

Run:

```bash
git status --short
git diff -- README.md skills/pordee plugins/pordee/skills/pordee tests/test_skill_sync.js
```

Expected: only docs and sync-verification changes, with no runtime behavior drift.
