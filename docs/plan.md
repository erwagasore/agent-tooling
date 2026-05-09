# Plan — Skill/docs polish and alignment

Cycle goal: reconcile the remaining skill/docs drift so the public workflow docs match the implemented extension-backed architecture after v0.10.0.

## How to use

1. Pick the next unchecked task and create a branch for only that task.
2. Keep each branch independently committable and mergeable; update docs/tests with the change.
3. Tick the task only after its PR merges, usually as the first commit on the next branch.

## Phase 1 — Small repo-map correction

- [x] **`docs(agents): fix remaining repo-map drift`**

  Update `AGENTS.md` stale wording for `skills/detect-existing-pr/` so it says the skill reports the latest PR in any state (`open`, `merged`, or `closed`), not open-only. While there, review whether `AGENTS.md` should mention v0.10.0 verification/package metadata in the repo map without duplicating SPEC. This anchors to `SPEC.md:196` (Utility skills) and `SPEC.md:280` (File layout).

  *Done when:* `AGENTS.md` no longer contradicts `detect-existing-pr` behavior and remains aligned with SPEC.

## Phase 2 — Skill docs aligned to extension-backed workflows

- [ ] **`docs(skills): slim create-pr around git-pr`**

  Rewrite `skills/create-pr/SKILL.md` as a human-facing PR workflow doc backed by `git_pr()`, similar to `create-release` → `/release` and `ship-feature` → `/ship`. Remove stale direct-provider details like unsupported Gitea draft handling, while preserving judgement steps the user still owns: confirm push, title/body quality, and draft choice. This anchors to `SPEC.md:135` (`git-pr`) and `SPEC.md:207` (Workflow skills).

  *Done when:* `create-pr` clearly delegates mechanical PR creation to `git-pr` / shared helpers and no longer documents provider behavior that is not implemented.

- [ ] **`docs(skills): align cleanup-branch with worktree safety`**

  Update `skills/cleanup-branch/SKILL.md` so its worktree wording matches current reality: pi cannot `cd` for the user, `/wt land` has stricter safety rules, and `/ship` is the canonical post-merge cleanup path. This anchors to `SPEC.md:167` (`git-worktree`) and `SPEC.md:267` (Worktree mode).

  *Done when:* cleanup docs no longer imply unsafe/direct `cd` behavior and point users toward `/ship` or `/wt land` for worktree cleanup.

- [ ] **`docs(skills): clarify init-repo provider support`**

  Clarify `skills/init-repo/SKILL.md` provider support versus the implemented `git-*` surface. Current docs mention Codeberg/Gitea while most extensions only support GitHub/GitLab for automated PR/release publishing and detect Bitbucket without publishing support. This anchors to `SPEC.md:135` (`git-pr`), `SPEC.md:153` (`git-release`), and `SPEC.md:207` (Workflow skills).

  *Done when:* init-repo accurately distinguishes provider setup guidance from the currently supported automated PR/release providers.

## Phase 3 — Policy alignment

- [ ] **`docs(agents): document bootstrap default-branch exception`**

  Resolve the policy mismatch between `skills/bootstrap-project/SKILL.md`, which allows an initial docs bootstrap commit on the default branch, and `AGENTS.md`, which currently names only `/release` as a direct-to-default exception. Document bootstrap initial setup as an explicit exception, scoped to the first repository setup before normal PR workflow starts. This anchors to `SPEC.md:222` (Composite skills), `SPEC.md:239` (Conventions), and `AGENTS.md` Workflow/Releases.

  *Done when:* bootstrap and AGENTS agree that initial setup may commit directly to default, while normal feature work and subsequent docs changes still go through branches/PRs.

## Ordering and parallelism

- Task 1 is independent and smallest.
- Tasks 2, 3, and 4 are independent skill-doc alignment tasks and can be done in any order after the plan lands.
- Task 5 is docs-only but carries policy weight; keep it separate from task 1 even though both edit `AGENTS.md`.
- All tasks are docs-only, but each branch should still run `npm run verify` as the repo baseline.
