# Plan — Extension coverage hardening

Cycle goal: broaden automated coverage across the remaining under-tested extensions so the v0.10.x extension surface has regression protection beyond release/worktree helpers.

## How to use

1. Pick the next unchecked task and create a branch for only that task.
2. Keep each branch independently committable and mergeable; update tests/docs with the change.
3. Tick the task only after its PR merges, usually as the first commit on the next branch.

## Phase 1 — Core tool coverage

- [x] **`test(extensions): cover git-context tool behavior`**

  Add tests for `pi-extensions/git-context/index.ts`: provider detection integration, default/current branch fields, clean/dirty state, remote presence, existing PR presence/null, warning paths, and formatted summary output via the mock pi harness. This anchors to `SPEC.md:82` (`git-context`) and `SPEC.md:200-205` (utility skills backed by git-context).

  *Done when:* `git_context()` success and soft-failure paths are covered without live remotes, and `npm run verify` passes.

- [x] **`test(extensions): cover git-guard assertions`**

  Add tests for `pi-extensions/git-guard/index.ts`: `requireClean`, `requireRemote`, `requireBranch`, `requireMode`, detached-head behavior, multi-failure aggregation, `isError` behavior, and formatted pass/fail summaries. This anchors to `SPEC.md:99` (`git-guard`) and `SPEC.md:200-201` (preflight/worktree utility skills).

  *Done when:* each guard option and representative combinations are covered, including failure details and `isError`.

- [x] **`test(extensions): cover git-pr tool behavior`**

  Add tests for `pi-extensions/git-pr/index.ts`: validation failures, unsupported providers, default-branch guard, detached-head guard, existing open PR reuse, closed/merged PR non-reuse, successful GitHub/GitLab creation through shared `createPr()`, and error details. This anchors to `SPEC.md:135` (`git-pr`) and `SPEC.md:212` (`create-pr`).

  *Done when:* `git_pr()` tool execution behavior is covered through the committed mock pi harness.

## Phase 2 — Command phase coverage

- [x] **`test(extensions): cover git-ship command phases`**

  Expand beyond `detectShipState()` and test command/phase behavior in `pi-extensions/git-ship/index.ts`: status-only mode, default-clean/default-dirty messages, no-pr push confirmation/cancel path, no-pr dirty guard, pr-open output, pr-closed warning, and pr-merged branch cleanup command sequence where practical. This anchors to `SPEC.md:117` (`git-ship`) and `SPEC.md:237` (canonical `/ship`).

  *Done when:* high-level `/ship` phase behavior is covered without live provider CLIs, and shared-helper mocks keep tests deterministic.

## Phase 3 — Non-git extension smoke coverage

- [x] **`test(extensions): cover plan-cycle and peculiars`**

  Add lightweight tests for the two non-`git-*` extensions: `pi-extensions/plan-cycle/index.ts` should cover no-arg planning, empty-session model switch, and active-session choices (`KEEP`, `SWITCH`, `CANCEL`, plus `FRESH` if mockable); `pi-extensions/peculiars/index.ts` should cover event handlers setting/clearing working messages and headless no-op behavior. This anchors to `AGENTS.md:41-42` (repo-map entries) and `SPEC.md:268` (verification convention).

  *Done when:* both non-`git-*` extensions have at least smoke-level regression coverage.

## Ordering and parallelism

- Tasks 1, 2, and 3 are independent and can be done in any order.
- Task 4 benefits from existing shared-helper tests but can proceed independently.
- Task 5 is independent and intentionally lightweight.
- All tasks should run `npm run verify`; no docs changes are expected unless tests reveal a contract drift.
