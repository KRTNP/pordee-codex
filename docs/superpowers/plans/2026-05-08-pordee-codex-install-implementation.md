# Pordee Codex Install Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real project-local Codex install flow for `pordee` that vendors a packaged plugin bundle into a target project and registers it in the target project's marketplace metadata.

**Architecture:** Add a dedicated packaged plugin surface under `plugins/pordee/`, then implement thin shell/PowerShell entrypoints that call a Node installer in `tools/install-codex-plugin.js`. The installer copies only the packaged bundle into `<target>/.codex-plugins/pordee` and merges `<target>/.agents/plugins/marketplace.json` idempotently.

**Tech Stack:** Node.js CommonJS, built-in `node:test`, built-in `fs`/`path`, POSIX shell, PowerShell, Markdown docs.

---

## File Structure

| Path | Responsibility |
|---|---|
| `plugins/pordee/.codex-plugin/plugin.json` | Codex local plugin manifest |
| `plugins/pordee/skills/pordee/SKILL.md` | Packaged skill surface shipped to target projects |
| `tools/install-codex-plugin.js` | Installer logic: validate target, copy bundle, merge marketplace |
| `install.sh` | Unix entrypoint wrapper for Node installer |
| `install.ps1` | Windows entrypoint wrapper for Node installer |
| `tests/test_codex_install.js` | Installer unit/integration tests on temp dirs |
| `README.md` | Codex install docs and manual removal notes |

---

### Task 1: Package a Codex plugin bundle

**Files:**
- Create: `plugins/pordee/.codex-plugin/plugin.json`
- Create: `plugins/pordee/skills/pordee/SKILL.md`
- Test: manual file inspection

- [ ] **Step 1: Create the failing packaging check**

```bash
test -f plugins/pordee/.codex-plugin/plugin.json
test -f plugins/pordee/skills/pordee/SKILL.md
```

Expected: one or both commands fail because packaged plugin files do not exist yet.

- [ ] **Step 2: Create Codex plugin manifest**

```json
{
  "name": "pordee",
  "description": "Thai+English terse communication mode for Codex.",
  "skills": [
    {
      "name": "pordee",
      "path": "skills/pordee/SKILL.md"
    }
  ]
}
```

Save to `plugins/pordee/.codex-plugin/plugin.json`.

- [ ] **Step 3: Create packaged skill file**

Use the existing root skill as the source text and copy it into:

```text
plugins/pordee/skills/pordee/SKILL.md
```

The packaged copy must expose the same `pordee` behavior as the root skill. Do not rewrite the rules in a different voice.

- [ ] **Step 4: Verify packaged files exist**

Run:

```bash
test -f plugins/pordee/.codex-plugin/plugin.json
test -f plugins/pordee/skills/pordee/SKILL.md
```

Expected: both commands succeed.

- [ ] **Step 5: Commit**

```bash
git add plugins/pordee/.codex-plugin/plugin.json plugins/pordee/skills/pordee/SKILL.md
git commit -m "feat: add packaged pordee codex plugin bundle"
```

### Task 2: Build installer tests first

**Files:**
- Create: `tests/test_codex_install.js`
- Test: `tests/test_codex_install.js`

- [ ] **Step 1: Write the failing installer tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-install-'));
  const sourceRoot = path.resolve(__dirname, '..');
  const targetRoot = path.join(root, 'target-project');
  fs.mkdirSync(targetRoot, { recursive: true });
  return { root, sourceRoot, targetRoot };
}

test('installIntoProject copies plugin bundle into .codex-plugins/pordee', async () => {
  const { installIntoProject } = require('../tools/install-codex-plugin.js');
  const env = makeEnv();
  await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });
  assert.ok(fs.existsSync(path.join(env.targetRoot, '.codex-plugins', 'pordee', '.codex-plugin', 'plugin.json')));
});

test('installIntoProject creates marketplace.json when missing', async () => {
  const { installIntoProject } = require('../tools/install-codex-plugin.js');
  const env = makeEnv();
  await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });
  const marketplace = JSON.parse(fs.readFileSync(path.join(env.targetRoot, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
  assert.equal(marketplace.plugins[0].name, 'pordee');
});

test('installIntoProject merges without duplicating pordee entry', async () => {
  const { installIntoProject } = require('../tools/install-codex-plugin.js');
  const env = makeEnv();
  const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
  fs.mkdirSync(marketplaceDir, { recursive: true });
  fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), JSON.stringify({
    plugins: [
      { name: 'other-plugin', path: './.codex-plugins/other-plugin' },
      { name: 'pordee', path: './.codex-plugins/pordee' }
    ]
  }, null, 2));
  await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });
  const marketplace = JSON.parse(fs.readFileSync(path.join(marketplaceDir, 'marketplace.json'), 'utf8'));
  assert.equal(marketplace.plugins.filter(p => p.name === 'pordee').length, 1);
});

test('installIntoProject fails on invalid marketplace JSON', async () => {
  const { installIntoProject } = require('../tools/install-codex-plugin.js');
  const env = makeEnv();
  const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
  fs.mkdirSync(marketplaceDir, { recursive: true });
  fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), '{bad json');
  await assert.rejects(
    installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
    /marketplace/i
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/test_codex_install.js
```

Expected: FAIL with `Cannot find module '../tools/install-codex-plugin.js'`

- [ ] **Step 3: Commit failing tests once they exist locally**

```bash
git add tests/test_codex_install.js
git commit -m "test: add codex installer coverage"
```

### Task 3: Implement Node installer core

**Files:**
- Create: `tools/install-codex-plugin.js`
- Modify: `tests/test_codex_install.js`
- Test: `tests/test_codex_install.js`

- [ ] **Step 1: Implement minimal installer API**

```javascript
const fs = require('node:fs');
const path = require('node:path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirRecursive(sourceDir, targetDir) {
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function readMarketplace(filePath) {
  if (!fs.existsSync(filePath)) return { plugins: [] };
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error('Invalid marketplace JSON');
  }
}

function upsertPordeePlugin(marketplace) {
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins.slice() : [];
  const entry = { name: 'pordee', path: './.codex-plugins/pordee' };
  const filtered = plugins.filter(plugin => plugin.name !== 'pordee');
  filtered.push(entry);
  return { ...marketplace, plugins: filtered };
}

async function installIntoProject({ sourceRoot, targetRoot }) {
  if (!targetRoot || !fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error('Target project path must exist and be a directory');
  }

  const pluginSource = path.join(sourceRoot, 'plugins', 'pordee');
  const pluginTarget = path.join(targetRoot, '.codex-plugins', 'pordee');
  const marketplacePath = path.join(targetRoot, '.agents', 'plugins', 'marketplace.json');

  copyDirRecursive(pluginSource, pluginTarget);
  ensureDir(path.dirname(marketplacePath));
  const marketplace = readMarketplace(marketplacePath);
  const updated = upsertPordeePlugin(marketplace);
  fs.writeFileSync(marketplacePath, JSON.stringify(updated, null, 2));

  return { pluginTarget, marketplacePath };
}

module.exports = { installIntoProject, upsertPordeePlugin, readMarketplace };
```

- [ ] **Step 2: Run installer tests**

Run:

```bash
node --test tests/test_codex_install.js
```

Expected: PASS

- [ ] **Step 3: Add current-directory default and target validation test**

```javascript
test('resolveTargetRoot defaults to cwd when project not provided', () => {
  const { resolveTargetRoot } = require('../tools/install-codex-plugin.js');
  const cwd = process.cwd();
  assert.equal(resolveTargetRoot({}), cwd);
});
```

Then implement:

```javascript
function resolveTargetRoot({ project } = {}) {
  return project ? path.resolve(project) : process.cwd();
}
```

- [ ] **Step 4: Re-run tests**

Run:

```bash
node --test tests/test_codex_install.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/install-codex-plugin.js tests/test_codex_install.js
git commit -m "feat: add codex plugin installer core"
```

### Task 4: Add shell and PowerShell entrypoints

**Files:**
- Create: `install.sh`
- Create: `install.ps1`
- Modify: `tools/install-codex-plugin.js`
- Test: manual command sanity check

- [ ] **Step 1: Add CLI mode to Node installer**

Append:

```javascript
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectFlagIndex = args.indexOf('--project');
  const project = projectFlagIndex >= 0 ? args[projectFlagIndex + 1] : undefined;
  const targetRoot = resolveTargetRoot({ project });
  installIntoProject({ sourceRoot: path.resolve(__dirname, '..'), targetRoot })
    .then(({ pluginTarget, marketplacePath }) => {
      console.log(`Installed pordee to ${pluginTarget}`);
      console.log(`Updated marketplace: ${marketplacePath}`);
      console.log('Next: restart Codex and enable pordee from Plugins UI.');
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Create Unix wrapper**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$ROOT_DIR/tools/install-codex-plugin.js" "$@"
```

- [ ] **Step 3: Create PowerShell wrapper**

```powershell
param(
  [string]$Project
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($Project) {
  node "$Root\tools\install-codex-plugin.js" --project $Project
} else {
  node "$Root\tools\install-codex-plugin.js"
}
```

- [ ] **Step 4: Sanity-check wrappers**

Run:

```bash
bash install.sh --project /tmp
```

Expected: either installs into `/tmp` if suitable for a temp run, or fails with a clear target validation message.

Run:

```bash
node tools/install-codex-plugin.js --project .
```

Expected: prints installed plugin path and marketplace path.

- [ ] **Step 5: Commit**

```bash
git add install.sh install.ps1 tools/install-codex-plugin.js
git commit -m "feat: add codex install entrypoints"
```

### Task 5: Document Codex install flow

**Files:**
- Modify: `README.md`
- Test: manual doc read

- [ ] **Step 1: Add install section for project-local Codex setup**

```md
## ติดตั้งสำหรับ Codex

ติดตั้งแบบ project-local:

```bash
./install.sh --project /path/to/your/project
```

หรือถ้ารันจากในโปรเจกต์เป้าหมาย:

```bash
/path/to/pordee/install.sh
```

Windows:

```powershell
powershell -File .\install.ps1 -Project C:\path\to\your\project
```
```

- [ ] **Step 2: Add output layout and removal notes**

```md
ตัวติดตั้งจะเขียน:

- `<project>/.codex-plugins/pordee`
- `<project>/.agents/plugins/marketplace.json`

ลบแบบ manual:

- ลบ `.codex-plugins/pordee`
- เอา entry `pordee` ออกจาก `.agents/plugins/marketplace.json`
```

- [ ] **Step 3: Review README wording**

Run:

```bash
sed -n '1,220p' README.md
```

Expected: Claude install path กับ Codex install path ถูกแยกชัด, ไม่มีข้อความสื่อว่า Codex install “มีอยู่แล้ว” ถ้ายังไม่อธิบาย command

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add codex install instructions"
```

### Task 6: Full verification

**Files:**
- Modify: none unless verification finds a concrete bug
- Test: `tests/test_codex_install.js`, full suite, installer sanity

- [ ] **Step 1: Run installer tests**

Run:

```bash
node --test tests/test_codex_install.js
```

Expected: PASS

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 3: Run in-repo install sanity check**

Run:

```bash
node tools/install-codex-plugin.js --project .
```

Expected:
- `.codex-plugins/pordee` exists in current repo
- `.agents/plugins/marketplace.json` updated or created
- output prints next steps

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended tracked changes plus generated local install artifacts if the sanity check wrote them

- [ ] **Step 5: Commit final verification state**

```bash
git add plugins/pordee tools/install-codex-plugin.js install.sh install.ps1 tests/test_codex_install.js README.md
git commit -m "feat: add project-local codex install flow"
```

---

## Self-Review

### Spec coverage

- packaged plugin bundle: Task 1
- installer core: Task 2, Task 3
- shell/PowerShell entrypoints: Task 4
- README install docs: Task 5
- idempotent verification and sanity checks: Task 6

No spec section is left without a corresponding task.

### Placeholder scan

- no `TODO` / `TBD`
- exact file paths provided
- explicit commands provided
- explicit commit messages provided

### Type consistency

- installer API names used consistently:
  - `installIntoProject`
  - `upsertPordeePlugin`
  - `readMarketplace`
  - `resolveTargetRoot`

