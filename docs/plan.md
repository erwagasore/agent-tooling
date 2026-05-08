# Plan — Testing, docs sync, and safety hardening

Cycle goal: establish a tested, docs-synced, safer foundation for the `git-*` extensions and release/worktree workflows before expanding provider scope.

## How to use

1. Pick the next unchecked task and create a branch for only that task.
2. Keep each branch independently committable and mergeable; update tests/docs with the change.
3. Tick the task only after its PR merges, usually as the first commit on the next branch.

## Phase 1 — Verification foundation

- [x] **`chore(test): add Vitest verification harness`**

  Add committed dev tooling for extension verification: `typescript`, `vitest`, `@types/node`, `tsconfig.json`, test scripts, and a lightweight pi-extension harness for invoking tools/commands without relying on ad-hoc `/tmp` smoke files. This anchors to the repository file-layout convention in `SPEC.md:268` and keeps verification local to the repo.

  *Done when:* `npm run verify` exists, runs typecheck plus tests, and passes with at least one committed smoke/unit test.

- [x] **`test(extensions): cover git-release and shared helpers`**

  Add tests for `pi-extensions/git-release/index.ts` and `pi-extensions/_shared/git-internals.ts`: semver parsing, bump computation, changelog rendering, `BREAKING CHANGE` footer detection, provider detection, and PR URL parsing where practical. This anchors to `SPEC.md:153` (`git-release`) and `SPEC.md:135` (`git-pr`).

  *Done when:* the classifier false-positive found while dogfooding `v0.9.0` is permanently covered, and shared helper behavior has regression tests.

- [x] **`test(extensions): cover git-ship and git-worktree behavior`**

  Add tests for `pi-extensions/git-ship/index.ts` state detection and `pi-extensions/git-worktree/index.ts` helper behavior: branch/path sanitisation, worktree-list parsing, and table formatting. This anchors to `SPEC.md:117` (`git-ship`) and `SPEC.md:167` (`git-worktree`).

  *Done when:* core state/path logic is covered without requiring live git remotes or host-provider CLIs.

## Phase 2 — Release and worktree safety

- [x] **`fix(extensions): harden git-release safety checks`**

  Make `/release` safer in `pi-extensions/git-release/index.ts`: use explicit `git add` instead of `git commit -am`, preflight existing local/remote tags, surface provider auth status before mutation where possible, and print clear recovery steps for partial failures. This anchors to `SPEC.md:153` (`git-release`) and preserves the documented direct local release pipeline.

  *Done when:* `/release` cannot silently omit a newly-created `CHANGELOG.md`, tag collisions fail before mutation, and failure modes explain how to recover.

- [x] **`feat(extensions): support multi-manifest releases`**

  Add manifest adapters so `/release` can operate across project types instead of being Node-only. Start with `package.json`, `Cargo.toml`, and `pyproject.toml`; detect supported manifests, read/write versions consistently, and handle multiple detected manifests deliberately. This anchors to `SPEC.md:153` (`git-release`) and the repo's goal that release tooling be reusable across languages.

  *Done when:* supported manifests are detected and bumped consistently, with tests for each adapter and clear behavior when multiple supported manifests exist.

- [x] **`fix(extensions): harden git-worktree safety`**

  Make `/wt` safer in `pi-extensions/git-worktree/index.ts`: validate branch names with `git check-ref-format --branch`, fetch/prune before creation, improve main-worktree path resolution, and refuse unsafe land/remove cases with clear guidance. This anchors to `SPEC.md:255` (Worktree mode) and the `git-worktree` command surface in `SPEC.md:167`.

  *Done when:* invalid branch/path cases fail before mutation, stale-base risks are reduced, and tests cover the new guard rails.

## Phase 3 — Docs sync and public surface alignment

- [ ] **`feat(skills): teach sync-docs generated command sections`**

  Improve `skills/sync-docs/SKILL.md` so `/sync-docs` owns generated README sections for skills, extensions, slash commands, and provider/support notes. Use stable generated markers so manual prose is preserved while command listings can be refreshed from repo state and skill frontmatter. This anchors to `SPEC.md:216` (`sync-docs`).

  *Done when:* `/sync-docs` can refresh README command lists from repo state/frontmatter without clobbering manual prose.

- [ ] **`docs(repo): sync README and document release privilege`**

  Run or apply the improved `/sync-docs` output to update `README.md` to current reality: list all `git-*` extensions and slash commands, remove stale `/create-branch worktree` and pre-release claims, and clarify `detect-existing-pr` behavior. Also update `AGENTS.md` to document `/release` as the explicit direct-to-default exception after user confirmation. This anchors to `SPEC.md:239` (Conventions) and the workflow/releases rules in `AGENTS.md`.

  *Done when:* README matches the implemented command surface, and `AGENTS.md` reconciles the normal PR-only workflow with the special release privilege.

## Ordering and parallelism

- Task 1 blocks test tasks 2 and 3.
- Tasks 4, 5, and 6 should happen after task 1 so safety changes land with tests.
- Task 7 should happen before task 8 because README refresh should be owned by `/sync-docs`.
- Provider expansion beyond GitHub/GitLab is intentionally deferred until test coverage and abstractions are in place.
