# Plan — Style, release ergonomics, and small maintenance

Cycle goal: tighten the v0.10.x repo around style consistency, release ergonomics, and one small maintenance task — without expanding feature surface.

## How to use

1. Pick the next unchecked task and create a branch for only that task.
2. Keep each branch independently committable and mergeable; update tests/docs with the change.
3. Tick the task only after its PR merges, usually as the first commit on the next branch.

## Phase 1 — Style baseline

- [ ] **`chore(repo): add formatter and unify code style`**

  Pick a formatter (recommend Biome since it can replace Prettier + a basic linter), configure it for the repo, run it once across `pi-extensions/**` and `tests/**`, and add `format` / `format:check` scripts wired into `npm run verify`. Resolves the tab-vs-space inconsistency between older (`peculiars`, `plan-cycle`) and newer extensions. This anchors to `SPEC.md:268` (Verification), `SPEC.md:249` (Naming), and `SPEC.md:293` (File layout).

  *Done when:* `npm run format:check` passes on a single style across all extension and test files, and `npm run verify` runs the format check as part of local verification.

## Phase 2 — Release ergonomics

- [ ] **`fix(extensions): pass PR/MR bodies via files in shared createPr`**

  Update `pi-extensions/_shared/git-internals.ts` so PR/MR creation writes the body to a temp file and passes it through `gh pr create --body-file <file>` and the equivalent GitLab description-file flag (with a fallback if not supported). This mirrors the manual workflow already adopted for opening PRs and avoids any edge-case escaping issues. Tests in `tests/git-internals.test.ts` and `tests/git-pr.test.ts` should adapt to the new argument shape. This anchors to `SPEC.md:135` (`git-pr`).

  *Done when:* PR/MR bodies are passed through temp files for both supported providers, with tests verifying the file flag and body content, and `npm run verify` passes.

- [ ] **`feat(extensions): support release pre-release identifiers`**

  Extend `pi-extensions/git-release/index.ts` so `/release` can cut pre-releases (`-alpha.1`, `-rc.1`, …): semver helpers must parse and increment pre-release tags correctly when re-releasing the same identifier (`-rc.1` → `-rc.2`), the slash command must expose a way to specify a pre-release identifier, and `skills/create-release/SKILL.md` should drop the "not yet supported" note. This anchors to `SPEC.md:153` (`git-release`).

  *Done when:* pre-release versions can be computed and applied via `/release`, with tests covering parsing, bumping, and changelog/manifest writes, and the create-release skill reflects the new capability.

## Phase 3 — Small maintenance

- [ ] **`docs(agents): track pi-coding-agent rename plan`**

  Add a short, dated entry in `AGENTS.md` (or a new `docs/notes.md`) tracking the upstream rename to `@earendil-works/pi-coding-agent` so the migration is not forgotten. No code change yet; this is a deliberate watch-list entry. This anchors to `AGENTS.md` Workflow / Repo map and `package.json` devDependencies.

  *Done when:* the rename watch-item is documented in a single, discoverable place with a clear next-step trigger (e.g., when the new package reaches feature parity).

- [ ] **`chore(repo): delete stale fix/sync-docs-update-existing-files branch`**

  Remove the local stale branch `fix/sync-docs-update-existing-files`, whose origin is already gone, so `git branch -vv` is clean. This task does not produce a PR; tick it on the next branch's first commit alongside the previous task tick.

  *Done when:* `git branch -vv` shows only `main` and the active working branch.

## Ordering and parallelism

- Task 1 should land first; running the formatter once before other branches reduces merge churn.
- Tasks 2 and 3 are independent of each other and can be done in any order after task 1.
- Task 4 is a small docs change; can land any time.
- Task 5 is local-only and can be done at any point; it does not need a PR.
