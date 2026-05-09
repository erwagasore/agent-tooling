# AGENTS — agent-tooling

Operating rules for humans + AI.

## Workflow

- Never commit to `main`/`master`.
- Always start on a new branch.
- Only push after the user approves.
- Merge via PR.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/).

- fix → patch
- feat → minor
- feat! / BREAKING CHANGE → major
- chore, docs, refactor, test, ci, style, perf → no version change

## Releases

- Semantic versioning.
- Versions derived from Conventional Commits.
- Release performed locally via `/release` (no CI required); the `create-release` skill is the human-facing doc for this command.
- `/release` is the explicit direct-to-default exception: after user confirmation it may commit `chore: release vX.Y.Z`, create tag `vX.Y.Z`, and push the default branch with `--follow-tags`.
- Manifest (if present) is source of truth.
- Tags: vX.Y.Z

## Repo map

- `pi-extensions/` — pi coding agent extensions
- `pi-extensions/_shared/` — shared helpers for the git-* extensions (no `index.ts` → not loaded by pi)
- `pi-extensions/git-context/` — git-context: one-call git repository introspection
- `pi-extensions/git-guard/` — git-guard: declarative repo-state assertions
- `pi-extensions/git-pr/` — git-pr: provider-aware PR creation (gh / glab)
- `pi-extensions/git-release/` — git-release: version, changelog, tag and provider release via `/release`
- `pi-extensions/git-ship/` — git-ship: state-machine `/ship` command for the feature lifecycle
- `pi-extensions/git-worktree/` — git-worktree: linked worktree management via `/wt new` / `/wt land` / `/wt list`
- `pi-extensions/peculiars/` — peculiars: witty status messages during agent processing
- `pi-extensions/plan-cycle/` — plan-cycle: model-aware `/plan` command wrapping the create-plan skill
- `skills/` — pi coding agent skills
- `skills/bootstrap-project/` — bootstrap-project: initialise a new project end-to-end — repo, docs, and first working branch
- `skills/check-preflight/` — check-preflight: validate git repo and remote before proceeding
- `skills/check-worktree/` — check-worktree: verify the git working tree is clean
- `skills/cleanup-branch/` — cleanup-branch: delete local branch if merged and remote is gone
- `skills/commit-changes/` — commit-changes: stage and commit with a Conventional Commit message
- `skills/create-branch/` — create-branch: new branch from up-to-date default branch
- `skills/create-plan/` — create-plan: capture the current cycle's planned work in `docs/plan.md`
- `skills/create-pr/` — create-pr: push branch and create a squash-merge PR
- `skills/create-release/` — create-release: version, changelog, tag and push a release locally (human-facing doc for `/release`)
- `skills/create-skill/` — create-skill: scaffold a new pi skill following the standard architecture
- `skills/detect-default-branch/` — detect-default-branch: detect the default branch of the current repo
- `skills/detect-existing-pr/` — detect-existing-pr: report the latest PR for the current branch in any state (open / merged / closed)
- `skills/detect-provider/` — detect-provider: detect git hosting provider and CLI from remote URL
- `skills/init-repo/` — init-repo: initialise repo, create remote, configure branch protection
- `skills/promote-plan/` — promote-plan: promote completed `docs/plan.md` into SPEC.md and reset for the next cycle
- `skills/ship-feature/` — ship-feature: push, create PR, and after merge clean up and land back on default branch (human-facing doc for `/ship`)
- `skills/stress-test-spec/` — stress-test-spec: stress-test project spec files by asking one question at a time to find gaps, ambiguities, contradictions, and untestable rules
- `skills/sync-docs/` — sync-docs: create or update core repo documentation from templates
- `skills/sync-docs/templates/` — document templates (README, AGENTS, SPEC, REFERENCE, LICENSE, docs/index, CONTRIBUTING)
- `tests/` — Vitest coverage for deterministic extension behaviour

## Merge strategy

- Prefer squash merge.
- PR title must be a valid Conventional Commit.

## Definition of done

- Works locally.
- Tests updated if behaviour changed.
- CHANGELOG updated when user-facing.
- No secrets committed.

## Orientation

- **Architecture**: see [SPEC.md](SPEC.md) for the four-layer model (Composite → Workflow → Utility → Extension), extension specs, and conventions.
- **Entry point**: `skills/` — each subdirectory is a self-contained pi skill with a `SKILL.md` and supporting files.
- **Domain**: reusable pi coding agent extensions and skills, publicly shared under MIT.
- **History**: see [CHANGELOG.md](CHANGELOG.md) for all release history and decisions.
