# Plan — extension layer for git skills

**Cycle goal:** Extract the mechanical git utility skills into a deterministic `git-*` extension layer, so skills only carry judgement-heavy work.

## How to use

1. Pick the next unchecked task.
2. Branch off the default branch (`feat/<scope>` or `refactor/<scope>`).
3. Tick the box when the PR merges; run `/promote-plan` once every box is ticked.

## Tasks

- [x] **`docs(spec): introduce SPEC.md and retire ARCHITECTURE.md`**
  Author `SPEC.md` at the repo root describing the 4-layer skill model (Extension → Utility → Workflow → Composite) and listing all six planned `git-*` extensions with their tool shapes (`git-context`, `git-guard`, `git-ship`, `git-pr`, `git-release`, `git-worktree`). Update `AGENTS.md` repo map to reference `SPEC.md`. Delete `docs/ARCHITECTURE.md`.
  *Done when:* `SPEC.md` exists at the repo root, `AGENTS.md` references it, `docs/ARCHITECTURE.md` is gone.

- [ ] **`feat(extensions): add git-context extension`**
  Create `pi-extensions/git-context/` exposing a `git_context()` tool that returns `{ provider, defaultBranch, currentBranch, mode, isClean, hasRemote, existingPr }` in one call. Anchored to SPEC § Extensions / git-context.
  *Done when:* the extension installs into pi, the tool returns the struct against this repo, and behaviour is covered by a fixture-repo test.

- [ ] **`feat(extensions): add git-guard extension`**
  Create `pi-extensions/git-guard/` exposing `git_guard({ requireClean, requireRemote })`, replacing the always-paired `check-preflight` + `check-worktree` calls. Anchored to SPEC § Extensions / git-guard.
  *Done when:* the tool throws structured errors that downstream skills can consume, and behaviour is covered by a fixture-repo test.

- [ ] **`refactor(skills): slim utility skills to delegate to git-context/git-guard`**
  Trim `skills/check-preflight/SKILL.md`, `skills/check-worktree/SKILL.md`, `skills/detect-default-branch/SKILL.md`, `skills/detect-existing-pr/SKILL.md`, `skills/detect-provider/SKILL.md`, and `skills/cleanup-branch/SKILL.md` to ≤ 20 lines each, deferring to the extension tools. Anchored to SPEC § Utility layer.
  *Done when:* each of the six SKILL.md files is ≤ 20 lines and references its backing extension tool by name.

- [ ] **`feat(extensions): add git-ship extension`**
  Create `pi-extensions/git-ship/` turning the `ship-feature` state machine into code: detect state (no PR / open PR / merged PR), dispatch the right phase, print status. Shells out to `gh`/`glab` directly until `git-pr` lands in a later cycle. Anchored to SPEC § Composite layer / ship.
  *Done when:* `/ship` runs the three phases end-to-end on this repo without LLM round-trips for mechanical steps, and `skills/ship-feature/SKILL.md` is updated to point at the extension as the canonical implementation.

## Ordering and parallelism

```
(1) SPEC.md  →  (2) git-context  →  (3) git-guard  →  (4) slim utility skills  →  (5) git-ship
```

- **(1)** must land first — every later task anchors to a SPEC section.
- **(2)** is the keystone — (3), (4), (5) all consume `git_context()`.
- **(3)** could parallelise with (2) after (1), but sequencing keeps PRs small and reviewable.
- **(4)** waits for (2) and (3); it depends on both extensions existing.
- **(5)** closes the cycle and is the headline user-visible win.

Deferred to the next cycle (already documented in SPEC.md by task 1): `git-pr`, `git-release`, `git-worktree`.
