# Changelog

## [0.1.1] — 2026-02-07

### Fixes

- Auto-switch to default branch and clean up merged branches when running create-release
- Use annotated tags so they push with `--follow-tags`, and create provider releases with changelog notes

## [0.1.0] — 2026-02-07

### Features

- Add create-branch, create-pr, init-repo, and create-release skills with consistent `<verb>-<noun>` naming
- Rename repo-docs to sync-docs to reflect repeatable usage

### Other

- Bootstrap repository documentation (README, AGENTS, LICENSE, CONTRIBUTING, docs/index)
- Add create-release skill and update create-branch with wip type and merged branch cleanup
