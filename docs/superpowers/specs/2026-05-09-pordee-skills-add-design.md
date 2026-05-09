# pordee Skills Add Support — Design Spec

**Date:** 2026-05-09
**Author:** Vatunyoo Suwannapisit
**Status:** Draft (pending implementation)

---

## 1. Overview

### 1.1 What

Add an officially supported installation path for:

```bash
npx skills add ...
```

using the existing root skill at `skills/pordee/SKILL.md`, while preserving the current Codex project-local plugin installer flow.

### 1.2 Why

Right now the repo supports:

- Claude Code plugin installation
- Codex project-local plugin installation via `install.sh` / `install.ps1`

But it does not clearly support Codex global skill installation through the `skills add` ecosystem, even though the repo already contains a valid root skill surface.

This leaves a gap:

- users who only want global `pordee` style behavior in Codex should not need the heavier project-local plugin installer
- docs should clearly separate global skill install from project-local plugin install

### 1.3 Goals

- Make `skills/pordee/SKILL.md` the documented and supported source for `npx skills add`
- Preserve existing project-local plugin installation unchanged
- Make the two Codex installation modes explicit in docs
- Add verification so the packaged plugin copy of the skill does not silently drift from the root skill

### 1.4 Non-goals

- No change to Claude plugin install flow
- No replacement of the project-local plugin installer
- No global Codex plugin installer
- No runtime/state behavior changes
- No packaging redesign beyond what is needed to support/document `skills add`

---

## 2. Installation Model

### 2.1 Global Codex skill install

This new supported path is for users who want the `pordee` skill installed into Codex’s global skills directory.

Canonical source:

```text
skills/pordee/SKILL.md
```

Expected user flow:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<ref>/skills/pordee
```

or equivalent repo/path form supported by the skill installer.

### 2.2 Project-local Codex plugin install

This existing path remains unchanged:

```bash
./install.sh --project /path/to/project
```

or:

```powershell
.\install.ps1 -Project C:\path\to\project
```

This continues to vendor:

- `<project>/.codex-plugins/pordee`
- `<project>/.agents/plugins/marketplace.json`

using the packaged plugin bundle under:

```text
plugins/pordee/
```

### 2.3 Positioning

The two Codex install modes are complementary, not competing:

- `npx skills add ...` = global skill install
- `install.sh --project ...` = project-local plugin install

Users choose based on scope, not based on version or platform.

---

## 3. Source of Truth and Sync

### 3.1 Canonical skill file

The root skill remains the canonical definition of `pordee` behavior:

```text
skills/pordee/SKILL.md
```

### 3.2 Packaged plugin copy

The packaged Codex plugin continues to ship a copied skill at:

```text
plugins/pordee/skills/pordee/SKILL.md
```

This copy exists for the project-local plugin bundle only.

### 3.3 Drift prevention

The repo must add explicit verification that the packaged copy matches the root skill content, except for any intentional packaging preamble if retained.

Acceptable designs:

- strict byte-for-byte equality
- normalized comparison that allows a single packaging note header in the packaged copy

Recommended:

- strict equality if possible
- otherwise a test helper that strips the known preamble and compares the rest exactly

---

## 4. Required Changes

### 4.1 README

Update `README.md` to present Codex installation as two separate paths:

1. Global skill installation via `npx skills add`
2. Project-local plugin installation via `install.sh` / `install.ps1`

The docs must explain:

- what each path installs
- where it installs
- when to choose each one

### 4.2 Verification test

Add a test that proves the packaged skill and root skill stay in sync.

This test must fail if one file changes without the other.

### 4.3 Optional packaging note handling

If the packaged skill keeps a “Source of truth” note at the top, the verification must define exactly how that note is ignored or preserved.

To reduce complexity, preferred outcome is to keep the two files identical and move packaging notes elsewhere if needed.

---

## 5. Risks

### 5.1 User confusion between install modes

If README mixes the two flows together, users may expect `npx skills add` to install project-local plugin wiring.

Mitigation:

- separate headings
- explicit “global” vs “project-local” wording

### 5.2 Skill drift

If the root skill changes but the packaged plugin copy does not, Codex behavior diverges by install method.

Mitigation:

- add sync verification test

### 5.3 Over-promising runtime parity

The `skills add` path installs the skill, not the full project-local plugin surface.

Mitigation:

- document that distinction explicitly
- do not claim feature parity with local plugin installation unless actually true

---

## 6. Decision

Proceed with a dual-path Codex installation model:

- support and document `npx skills add` using `skills/pordee/SKILL.md`
- keep project-local plugin installation unchanged
- add verification to keep the packaged skill copy synced with the root skill
- clarify the distinction in README without changing runtime behavior
