# pordee Codex Install Flow — Design Spec

**Date:** 2026-05-08
**Author:** Vatunyoo Suwannapisit
**Status:** Draft (pending implementation)

---

## 1. Overview

### 1.1 What

Add a real project-local Codex installation flow for `pordee`.

This phase is about packaging and distribution, not compression logic. After this work, a user should be able to point an installer at a target project and get a usable local Codex plugin bundle plus plugin registration metadata.

### 1.2 Why

`pordee` now has a shared core and a Codex adapter, but no practical install path for Codex users. The gap versus `caveman` is no longer feature logic first; it is installability and packaging. Without a real install flow, Codex support is technically present in-repo but not actually consumable.

### 1.3 Goals

- Support project-local Codex installation as v1
- Vendor `pordee` into a target project in a predictable location
- Register the vendored plugin in the target project's Codex plugin marketplace metadata
- Keep the install flow idempotent
- Leave room for a future global install mode without redesigning everything

### 1.4 Non-goals

- No global install in this phase
- No benchmark/eval scaffolding in this phase
- No multi-agent installer matrix like `caveman`
- No Windows GUI installer
- No automatic uninstall command unless it falls out naturally from the installer structure

---

## 2. Recommended Approach

Use **project-local vendoring**.

Installer behavior:

1. accept a target project path
2. copy or sync a prepared `pordee` Codex plugin bundle into:
   - `<target>/.codex-plugins/pordee`
3. update:
   - `<target>/.agents/plugins/marketplace.json`
4. ensure the marketplace entry points at the vendored plugin
5. print next steps for the user

This keeps install state local to the target repo, easy to inspect, easy to delete, and easy to reason about.

---

## 3. Architecture

### 3.1 Source layout in this repo

Add a dedicated packaged plugin surface:

```text
plugins/
  pordee/
    .codex-plugin/
      plugin.json
    skills/
      pordee/
        SKILL.md
```

Supporting installer logic:

```text
tools/
  install-codex-plugin.js

install.sh
install.ps1
```

### 3.2 Why a packaged plugin folder

Current repo contains source logic, tests, Claude plugin config, and docs. A Codex install flow should not copy the whole repo into user projects. It should copy a stable plugin bundle only.

Benefits:

- smaller install footprint
- clearer ownership boundary
- easier future versioning
- easier future global install support

### 3.3 Plugin contents

The vendored bundle must contain only what Codex needs:

- Codex plugin manifest
- `pordee` skill content
- any minimal support files needed by the plugin surface

Do **not** vendor tests, Claude hook files, graphify output, or project docs into the target project.

---

## 4. Install Target Layout

After install, target project should look like:

```text
<target>/
  .codex-plugins/
    pordee/
      .codex-plugin/
        plugin.json
      skills/
        pordee/
          SKILL.md
  .agents/
    plugins/
      marketplace.json
```

### 4.1 Marketplace registration

Installer must ensure `marketplace.json` references:

```json
{
  "plugins": [
    {
      "name": "pordee",
      "path": "./.codex-plugins/pordee"
    }
  ]
}
```

Exact final schema should match what Codex expects in this environment, but the core rule is:

- use a relative path from the target project
- do not duplicate the `pordee` entry on repeated install

### 4.2 Idempotency rules

Repeated install must:

- not create duplicate marketplace entries
- overwrite/sync the vendored `pordee` plugin bundle in place
- preserve unrelated plugin entries in `marketplace.json`

---

## 5. Installer Behavior

### 5.1 CLI interface

Phase 1 should support:

```bash
./install.sh --project /path/to/project
```

And Windows equivalent:

```powershell
powershell -File .\install.ps1 -Project C:\path\to\project
```

Optional convenience:

- if run inside a project and `--project` omitted, default to current directory

### 5.2 Validation

Installer must validate:

- target path exists
- target path is a directory
- installer has permission to create:
  - `.codex-plugins/`
  - `.agents/plugins/`

If validation fails:

- print exact reason
- exit non-zero

### 5.3 Marketplace update behavior

Cases:

1. file missing:
   - create `.agents/plugins/marketplace.json`
2. file exists with valid JSON:
   - merge `pordee` entry into existing plugin list
3. file exists but invalid JSON:
   - stop with clear error
   - do not overwrite user file

### 5.4 Copy strategy

Preferred behavior:

- installer copies from `plugins/pordee/` source bundle
- target bundle is fully refreshed on reinstall

No symlink dependency for v1.

Reason:

- symlinks are less portable
- copied bundle is easier for users to inspect and move

---

## 6. Plugin Manifest Strategy

Create a Codex plugin manifest under:

- `plugins/pordee/.codex-plugin/plugin.json`

This manifest should expose the `pordee` skill to Codex in the same shape Codex expects for local plugins in this environment.

Requirements:

- plugin name: `pordee`
- skill surface uses the same `skills/pordee/SKILL.md` behavior
- no duplication of core Thai compression rules into a second rule file unless required by Codex packaging

If duplication is unavoidable for packaging:

- document one file as source of truth
- sync the packaged copy deliberately, not manually ad hoc

---

## 7. Documentation Changes

README must separate two ideas clearly:

1. **behavior support**
   - `pordee` logic supports Codex
2. **install flow**
   - Codex local install uses the new project-local installer

User should not be left guessing whether “Codex support” means code exists only, or an actual install path exists.

README changes should include:

- project-local Codex install command
- where files are written
- how to re-run installer safely
- how to remove install manually

---

## 8. Testing

Required coverage:

- installer copies bundle to target location
- installer creates marketplace file when missing
- installer merges into existing marketplace file
- installer does not duplicate `pordee` entry
- installer fails cleanly on invalid marketplace JSON
- installer respects explicit target path
- installer defaults to current directory when appropriate

Tests should operate on temp directories only.

Prefer Node-based tests for installer logic, with shell scripts kept thin wrappers.

---

## 9. Risks

### 9.1 Marketplace schema mismatch

If local plugin marketplace schema is guessed wrong, install will “succeed” but Codex will not see the plugin.

Mitigation:

- inspect current local Codex conventions before implementing
- keep plugin manifest and marketplace entry minimal

### 9.2 Source-of-truth drift

If `plugins/pordee/skills/pordee/SKILL.md` diverges from root `skills/pordee/SKILL.md`, behavior will split.

Mitigation:

- choose one canonical file
- add sync rule or build step

### 9.3 Over-copying repo internals

If installer copies the full repo, target projects get tests/docs/noise they do not need.

Mitigation:

- package from `plugins/pordee/` only

---

## 10. Decision

Implement **project-local Codex installation first**.

That means:

- create a packaged plugin bundle under `plugins/pordee/`
- add thin shell/PowerShell entrypoints
- put real install logic in `tools/install-codex-plugin.js`
- vendor into `<target>/.codex-plugins/pordee`
- update `<target>/.agents/plugins/marketplace.json`

This is the smallest distribution system that turns current Codex support from in-repo capability into something users can actually install.
