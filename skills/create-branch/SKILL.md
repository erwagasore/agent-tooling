---
name: create-branch
description: Create a new branch from an up-to-date default branch.
---

Start a new feature/fix branch following Conventional Commit naming.

## Rules

1. **Preflight** — abort if not a git repo or no remote configured.
2. **Detect default branch**: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`, fallback `main`.
3. **Cleanup**: if current branch is not the default and has been merged (remote branch deleted or PR merged), delete it locally after switching away.
4. **Update**: `git fetch origin --prune` then `git checkout {default}` and `git pull origin {default}`.
5. **Branch name** — ask user for intent, then build name as `{type}/{short-description}`:
   - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`, `wip`.
   - Short description: lowercase, hyphens, no special characters.
   - `wip` needs no description — defaults to `wip/{YYYY-MM-DD}`. Add a short suffix if multiple in one day.
   - Example: `feat/add-login-flow`, `fix/null-pointer-on-save`, `wip/2026-02-07`.
6. **Create and checkout**: `git checkout -b {branch}`.
7. **Summary**: branch name, based on which default branch, confirm ready to work.
