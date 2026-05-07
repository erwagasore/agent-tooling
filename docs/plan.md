# Plan — close out SPEC's deferred extensions

**Cycle goal:** Land the three deferred `git-*` extensions (`git-pr`, `git-release`, `git-worktree`), slim the skills that currently inline what they will own, and reconcile AGENTS.md with the project's current state.

## How to use

1. Pick the next unchecked task.
2. Branch off the default branch (`feat/<scope>` or `refactor/<scope>` or `docs/<scope>`).
3. Tick the box when the PR merges; run `/promote-plan` once every box is ticked.

## Tasks

- [x] **`feat(extensions): add git-pr extension`**
  Create `pi-extensions/git-pr/` exposing a `git_pr({ title, body?, draft? })` tool that wraps `gh pr create` / `glab mr create` and returns `{ url, number }`. Detects an existing PR for the head branch first (re-uses it instead of duplicating). Bundles a refactor of `pi-extensions/git-ship/` so its `phaseNoPr` delegates to `git-pr` instead of shelling out to `gh`/`glab` directly. While here, lifts the duplicated PR-list JSON parsing (currently in `pi-extensions/git-context/` and `pi-extensions/git-ship/`) into `pi-extensions/_shared/git-internals.ts`. Anchored to SPEC § Extensions / git-pr (line 135) and § Extensions / git-ship.
  *Done when:* `pi-extensions/git-ship/index.ts` no longer references `gh`/`glab` directly; an end-to-end `/ship` run from `no-pr` state uses `git_pr` for PR creation; PR-list parsing has a single home in `_shared`.

- [x] **`feat(extensions): add git-release extension`**
  Create `pi-extensions/git-release/` exposing a `/release` slash command. `/release status` (or `--dry-run`) reads the latest tag, walks commits since it, classifies them as `fix` / `feat` / `feat!`, computes the next semver, and prints a CC-grouped changelog stub. `/release` additionally bumps `package.json`, prepends to `CHANGELOG.md`, commits as `chore: release vX.Y.Z`, tags annotated, pushes `--follow-tags`, and creates the provider release via `gh`/`glab`. Rewrites `skills/create-release/SKILL.md` as a thin human-facing doc pointing at `/release` (mirrors the `ship-feature` rewrite from the previous cycle). Anchored to SPEC § Extensions / git-release (line 143).
  *Done when:* `/release status` on this repo prints the same shape of output we built by hand for v0.8.0; `skills/create-release/SKILL.md` ≤ ~30 lines and references the extension.

- [ ] **`feat(extensions): add git-worktree extension`**
  Create `pi-extensions/git-worktree/` exposing three slash commands: `/wt new <name>` creates a `../{repo}-{name}` linked worktree on a new branch and prints the path with a `cd` hint; `/wt land` detects worktree mode via `git_context`, removes the linked worktree from the main repo, prunes, and prints the main-repo path; `/wt list` prints a formatted summary. Documents honestly that the extension cannot `cd` for the user — it can only print the destination path. Anchored to SPEC § Extensions / git-worktree (line 152).
  *Done when:* `/wt new foo` creates a clean linked worktree on this repo, `/wt list` shows it, and `/wt land` removes it cleanly.

- [ ] **`refactor(skills): slim create-branch and ship-feature for git-worktree`**
  Remove the branch-vs-worktree conditional logic from `skills/create-branch/SKILL.md` and `skills/ship-feature/SKILL.md`. Both skills defer worktree creation/cleanup to `/wt` (or to `git-ship`, which itself uses `git-worktree` helpers). Update `SPEC.md § Conventions / Worktree mode` to point at `/wt` and `docs/index.md` if any anchors changed. Anchored to SPEC § Conventions / Worktree mode and § Workflow / create-branch.
  *Done when:* neither `create-branch` nor `ship-feature` SKILL.md mentions worktree mode in its Rules section; SPEC's Worktree mode block points at `/wt`.

- [ ] **`docs(agents): reconcile AGENTS.md with current state`**
  Update `AGENTS.md` to reflect everything that drifted during and before this cycle. Add the missing repo-map entries: `pi-extensions/git-context/`, `pi-extensions/git-guard/`, `pi-extensions/git-ship/`, `pi-extensions/_shared/`, `pi-extensions/plan-cycle/`, `skills/create-plan/`, `skills/promote-plan/`, and this cycle's new `pi-extensions/git-pr/`, `pi-extensions/git-release/`, `pi-extensions/git-worktree/`. Update the Releases section to reference `/release` (the new slash command from task 2) as the canonical entry point. Verify the Orientation block still aligns with SPEC.md.
  *Done when:* `AGENTS.md` repo map lists every directory under `pi-extensions/` and `skills/`; the Releases section names `/release`; no other section drifts vs. SPEC.

## Ordering and parallelism

```
(1) git-pr  →  (2) git-release  →  (3) git-worktree  →  (4) slim skills  →  (5) reconcile AGENTS.md
```

- **(1)** is the keystone — frees `git-ship` from provider-specific code and centralises PR-list parsing in `_shared`.
- **(2)** is independent of (1) and (3); could parallelise but sequencing keeps PRs reviewable.
- **(3)** is independent of (1) and (2).
- **(4)** depends on (3) — needs `git-worktree` to exist before the skills can defer to it.
- **(5)** is naturally last; it documents what tasks 1–4 produced.

Tests remain deferred for this cycle (option C), per the previous cycle's pattern. Worth picking up as its own dedicated cycle once the extension surface area stabilises.
