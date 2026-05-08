# SPEC — agent-tooling

Architecture, conventions, and structural decisions for the pi skills and extensions in this repo.

## Overview

This repo ships two complementary kinds of artefacts for the pi coding agent:

- **Skills** (`skills/<name>/SKILL.md`) — markdown procedures the LLM follows. Best for judgement-heavy work: writing prose, choosing what to do, framing acceptance criteria.
- **Extensions** (`pi-extensions/<name>/index.ts`) — deterministic TypeScript that exposes tools or slash commands. Best for mechanical work: shell invocations, classification heuristics, state detection.

The dividing rule: **judgement → skill, mechanism → extension**.

## Architecture

Four layers. Each layer composes the ones beneath it.

```
+----------------------------------------------------------------+
|                          COMPOSITE                             |
|                                                                |
|   [bootstrap-project]              [ship-feature]              |
+--------|---------------------------------|--------------------+
         v                                 v
+----------------------------------------------------------------+
|                          WORKFLOW                              |
|                                                                |
|   [init-repo]   [sync-docs]   [create-branch]   [create-pr]    |
|   [create-release]  [create-skill]  [commit-changes]           |
|   [create-plan]     [promote-plan]                             |
+--------|---------------------------------|--------------------+
         v                                 v
+----------------------------------------------------------------+
|                          UTILITY                               |
|                                                                |
|   [check-preflight]  [check-worktree]  [cleanup-branch]        |
|   [detect-default-branch]  [detect-existing-pr]  [detect-provider]
+--------|---------------------------------|--------------------+
         v                                 v
+----------------------------------------------------------------+
|                          EXTENSION                             |
|                                                                |
|   git-context   git-guard   git-ship                           |
|   git-pr        git-release git-worktree                       |
+----------------------------------------------------------------+
```

### Layer rules

- **Extension** — deterministic code. No LLM round-trips. Exposes tools (functions) or slash commands. Replaces what would otherwise be repeated shell-scripting in markdown.
- **Utility** — single-purpose skill that reads context or validates state. No side effects beyond aborting. Most utility skills delegate to a corresponding extension tool.
- **Workflow** — one complete user-facing operation (a branch, a PR, a release, a doc sync). Composes utilities + extension tools. Carries judgement (e.g. writing a CC message, drafting a changelog).
- **Composite** — chains multiple workflow skills into a single invocation. Often a state machine (`ship-feature`).

### Edges

```
Composite → Workflow
  bootstrap-project → init-repo, sync-docs, create-branch
  ship-feature      → create-pr, commit-changes

Workflow → Utility
  create-branch  → check-preflight, check-worktree, detect-default-branch, cleanup-branch
  create-pr      → check-preflight, detect-default-branch, detect-provider, detect-existing-pr
  create-release → check-preflight, check-worktree, detect-default-branch, cleanup-branch, detect-provider
  init-repo      → detect-provider, detect-default-branch
  commit-changes → check-preflight

Utility → Extension
  check-preflight        → git-guard({ requireRemote: true })
  check-worktree         → git-guard({ requireClean: true })
  detect-default-branch  → git-context().defaultBranch
  detect-existing-pr     → git-context().existingPr
  detect-provider        → git-context().provider
  cleanup-branch         → git-context() + plain git
```

## Extensions

Six `git-*` extensions form the deterministic backbone. All share the `git-` prefix.

### `git-context`

One-call repo introspection. The keystone every other extension consumes.

```ts
git_context(): {
  provider: "github" | "gitlab" | "bitbucket" | "unknown";
  defaultBranch: string;
  currentBranch: string;
  mode: "branch" | "worktree";
  isClean: boolean;
  hasRemote: boolean;
  existingPr: { number: number; url: string; state: "open" | "merged" | "closed" } | null;
  warnings: string[];   // soft failures (e.g. missing gh CLI) — tool never throws
}
```

### `git-guard`

State assertions used at the start of every workflow.

```ts
git_guard(opts: {
  requireClean?: boolean;
  requireRemote?: boolean;
  requireBranch?: "default" | "non-default";
  requireMode?: "branch" | "worktree";
}): {
  ok: boolean;
  failures: { check: string; message: string }[];
  state: { isClean: boolean; hasRemote: boolean; currentBranch: string; defaultBranch: string; mode: "branch" | "worktree" };
}
// isError: true on any failure (pi tools surface failure via isError, not exceptions)
```

### `git-ship`

State-machine slash command. Replaces the prose state machine inside `ship-feature`.

```
/ship          → detect state, dispatch phase
/ship status   → print state and predicted action, do nothing
```

| State | Trigger | Action |
|---|---|---|
| `default-clean` | on default branch, worktree clean | Print "nothing to ship". |
| `default-dirty` | on default branch, worktree dirty | Print "create a branch first". |
| `no-pr` | on feature branch, no existing PR | Show diff + commits, confirm, push, prompt for title (default = last commit subject), auto-derive body, create PR via `gh`/`glab`, print URL. |
| `pr-open` | on feature branch, PR open | Print URL, exit — wait for merge then run `/ship` again. |
| `pr-merged` | on feature branch, PR merged | Cleanup branch (auto-detects branch vs worktree mode), `git fetch --prune`, `git pull` default. |
| `pr-closed` | on feature branch, PR closed without merge | Print warning. |

### `git-pr`

Provider-aware PR creation. Wraps `gh pr create` / `glab mr create`. Re-uses an existing open PR for the same head branch instead of opening a duplicate.

```ts
git_pr({ title: string; body?: string; draft?: boolean }): {
  ok: boolean;
  provider: "github" | "gitlab" | "bitbucket" | "unknown";
  number?: number;     // present when ok
  url?: string;        // present when ok
  reused?: boolean;    // present when ok — true if an existing open PR was returned
  reason?: string;     // present when !ok
}
// isError: true on any failure
```

The shape is intentionally flat (rather than a discriminated union) because pi's `TOutput` is inferred from the first return path; a union would force later returns into the narrow first type.

### `git-release`

Reads the latest `v*` tag, walks commits since it, classifies CC types, and either previews or applies a release.

```
/release status              → dry-run: print bump type, next version, draft changelog
/release                     → apply (uses computed bump from CC log)
/release patch|minor|major   → apply with explicit bump override
```

Apply pipeline: preflight before mutation (default branch, clean tree, origin present, tag not present locally/remotely, provider auth available for GitHub/GitLab) → confirm with user → detect the project root and infer language/ecosystem signals from root marker files → bump high-confidence built-in manifests/lockfiles (`package.json`, `package-lock.json`, `Cargo.toml`, `pyproject.toml`, `build.zig.zon`) plus any root manifest-like file with exactly one unambiguous semver-like version field (for example Elixir `mix.exs`) → skip ambiguous manifests instead of guessing → prepend `CHANGELOG.md` → explicitly `git add` changed manifests plus `CHANGELOG.md` → commit `chore: release vX.Y.Z` → tag annotated → confirm push → `git push origin {default} --follow-tags` → `gh release create` / `glab release create` with the changelog section as notes. Partial failures print recovery steps for the commit, tag, push, or provider-release phase.

The `create-release` skill is the human-facing doc for this command; the extension owns mechanism, the skill owns wording for any prose polish a release needs after the fact.

### `git-worktree`

Hides the branch-vs-worktree fork from the rest of the system. Three subcommands:

```
/wt new <branch>   → create linked worktree at ../<repo>-<sanitized-branch>
                     on a new branch from default; print a `cd` hint
/wt land           → from inside a linked worktree, remove and prune;
                     print a `cd` hint back to the main repo
/wt list           → print all worktrees in a friendly table (default subcommand)
```

Pi runs in one cwd and cannot `cd` for the user — the extension prints an explicit `cd "<path>"` hint after each operation. `/wt new` validates branch names with `git check-ref-format --branch`, resolves the main worktree safely, and runs `git fetch origin --prune` before creating a new branch so creation does not proceed on stale or unknown remote state. `/wt land` refuses to remove the main worktree, refuses dirty or unknown-cleanliness worktrees, removes only the working directory, and preserves the branch (use `git branch -d` separately, or let `/ship`'s pr-merged phase handle it via the same shared `removeWorktree` helper).

### Implementation status

| Extension | Status |
|---|---|
| `git-context` | implemented |
| `git-guard` | implemented |
| `git-ship` | implemented |
| `git-pr` | implemented |
| `git-release` | implemented |
| `git-worktree` | implemented |

The current cycle's task breakdown lives in `docs/plan.md`.

## Skills by layer

### Utility

| Skill | Purpose | Backing extension |
|---|---|---|
| `check-preflight` | Abort if not a git repo or no remote | `git-guard` |
| `check-worktree` | Abort if uncommitted changes | `git-guard` |
| `cleanup-branch` | Delete merged branch (auto-detects branch vs worktree) | `git-context` + plain git |
| `detect-default-branch` | Resolve default branch name | `git-context` |
| `detect-existing-pr` | Find latest PR for current branch (any state — callers filter) | `git-context` |
| `detect-provider` | Identify git host and CLI | `git-context` |

### Workflow

| Skill | Composes |
|---|---|
| `create-branch` | check-preflight → check-worktree → detect-default-branch → cleanup-branch |
| `create-pr` | check-preflight → detect-default-branch → detect-provider → detect-existing-pr |
| `create-release` | check-preflight → detect-default-branch → cleanup-branch → check-worktree → detect-provider |
| `commit-changes` | check-preflight |
| `init-repo` | detect-provider → detect-default-branch |
| `sync-docs` | standalone — scans repo, updates docs and generated README command/component sections |
| `create-skill` | standalone — scaffolds a new skill |
| `create-plan` | standalone — drafts `docs/plan.md` |
| `promote-plan` | standalone — folds plan into SPEC.md and resets |
| `stress-test-spec` | standalone — interrogates SPEC.md for gaps |

### Composite

| Skill | Composes | When |
|---|---|---|
| `bootstrap-project` | init-repo → sync-docs → create-branch | Day one of a new project |
| `ship-feature` | create-pr → cleanup-branch (state machine) | Ready to deliver |

`ship-feature` is a human-facing doc for the `/ship` state machine — run repeatedly:

```
/ship  →  No PR? Push and create one.
/ship  →  PR open? Print URL, wait for merge.
/ship  →  PR merged? Clean up and land on default.
```

`git-ship` is the canonical implementation; the skill keeps the prose workflow discoverable.

## Conventions

### Skill vs extension

When in doubt:

- Pure shell wrapping, classification, state detection → **extension**.
- Authoring prose, choosing what to do, judgement calls → **skill**.
- Both → workflow skill that calls extension tools.

### Naming

- Skills: `<verb>-<noun>` (e.g. `create-branch`, `detect-provider`).
- Extensions: every git-related extension carries the `git-` prefix (e.g. `git-context`, `git-ship`).
- Branches: `{type}/{short-description}` — lowercase, hyphens. `wip/{YYYY-MM-DD}` for ad-hoc work.

### Verification

Local verification is part of the repo contract. TypeScript and Vitest are the baseline for deterministic extension behavior.

```
npm run typecheck   → tsc --noEmit
npm test            → vitest run
npm run verify      → typecheck + tests
```

Tests live under `tests/` and should prefer pure helper coverage or mock pi-extension harnesses over live remotes. Any change to extension behavior should add or update tests in the same PR.

### Worktree mode

Branch mode is the default. Worktree mode lives behind `/wt`; the branching skills and `/ship`'s pr-merged phase share the same underlying `removeWorktree` helper from `_shared/git-internals`.

```
/create-branch              → branch mode (git checkout -b)
/wt new <branch>            → worktree mode (linked worktree at ../<repo>-<sanitized>)
/wt land                    → from inside a worktree, remove and prune
/ship                       → pr-merged phase auto-detects mode and lands appropriately
```

`/wt` cannot `cd` for the user — it prints an explicit `cd "<path>"` hint after each operation.

### File layout

```
SPEC.md                          ← architecture + conventions (this file)
AGENTS.md                        ← operational rules + repo map
README.md                        ← user-facing intro
CHANGELOG.md                     ← release history
CONTRIBUTING.md                  ← contributor guide
package.json                     ← pi package metadata + local verification scripts
package-lock.json                ← locked dev/runtime dependency graph
tsconfig.json                    ← TypeScript verification config
docs/
  index.md                       ← docs landing page
  plan.md                        ← transient cycle plan, promoted into SPEC
tests/                           ← Vitest coverage for deterministic extension behavior
skills/<name>/SKILL.md           ← skill definitions
pi-extensions/<name>/index.ts    ← extension code
pi-extensions/_shared/*.ts       ← cross-extension helpers (no index.ts → not loaded by pi)
```

Operational rules (commits, releases, merge strategy, definition of done) live in [AGENTS.md](AGENTS.md).
