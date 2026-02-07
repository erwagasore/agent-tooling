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
- Release performed locally via `/create-release` (no CI required).
- Manifest (if present) is source of truth.
- Tags: vX.Y.Z

## Repo map

- `pi-extensions/` — pi coding agent extensions (currently empty)
- `skills/` — pi coding agent skills
- `skills/create-branch/` — create-branch: new branch from up-to-date default branch
- `skills/create-pr/` — create-pr: push branch and create a squash-merge PR
- `skills/create-release/` — create-release: version, changelog, tag and push a release locally
- `skills/init-repo/` — init-repo: initialise repo, create remote, configure branch protection
- `skills/sync-docs/` — sync-docs: create or update core repo documentation from templates
- `skills/sync-docs/templates/` — document templates (README, AGENTS, LICENSE, docs/index, CONTRIBUTING)

## Merge strategy

- Prefer squash merge.
- PR title must be a valid Conventional Commit.

## Definition of done

- Works locally.
- Tests updated if behaviour changed.
- CHANGELOG updated when user-facing.
- No secrets committed.

## Orientation

- **Entry point**: `skills/` — each subdirectory is a self-contained pi skill with a `SKILL.md` and supporting files.
- **Domain**: reusable pi coding agent extensions and skills, publicly shared under MIT.

## Decisions

- 2026-02-07 — Initial scaffolding.
