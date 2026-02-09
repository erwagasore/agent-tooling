---
name: create-branch
description: Create a new branch from an up-to-date default branch.
---

Start a new feature/fix branch following Conventional Commit naming.

## Rules

1. **Preflight** — run `check-preflight` skill.
2. **Clean check** — run `check-worktree` skill.
3. **Detect default branch** — run `detect-default-branch` skill.
4. **Cleanup** — run `cleanup-branch` skill.
5. **Update**: `git fetch origin --prune` then `git checkout {default}` and `git pull origin {default}`.
6. **Branch name** — ask user for intent, then build name as `{type}/{short-description}`:
   - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`, `wip`.
   - Short description: lowercase, hyphens, no special characters.
   - `wip` needs no description — defaults to `wip/{YYYY-MM-DD}`. Add a short suffix if multiple in one day.
   - Example: `feat/add-login-flow`, `fix/null-pointer-on-save`, `wip/2026-02-07`.
7. **Collision check** — if the branch name already exists locally (`git show-ref --verify refs/heads/{branch}`) or on the remote (`git ls-remote --heads origin {branch}`), abort with a message and suggest a different name.
8. **Create**:
   - Default: `git checkout -b {branch}`.
   - If user passed `worktree` as argument (e.g. `/create-branch worktree`): `git worktree add ../{repo}-{branch} -b {branch}`, then `cd` into the new directory.
9. **Summary**: branch name, mode (branch or worktree), based on which default branch, confirm ready to work.
