# Changelog

## [0.3.1] — 2026-02-09

### Fixes

- sync-docs now updates repo-derived sections in existing files instead of only populating empty ones

### Other

- Extract cross-cutting patterns (preflight, default branch detection, provider detection, merged branch cleanup) into four reusable utility skills

## [0.3.0] — 2026-02-08

### Features

- Add peculiars extension — witty context-aware status messages during agent processing, covering tool calls, turn transitions, and agent start

## [0.2.0] — 2026-02-08

### Features

- Add create-skill: a meta-skill that scaffolds new skills following the standard lifecycle architecture

### Other

- Add quickstart steps to README with clone, symlink, and usage instructions

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
