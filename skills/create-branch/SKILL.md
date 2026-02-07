---
name: create-branch
description: Create a new branch from an up-to-date default branch.
---

Start a new feature/fix branch following Conventional Commit naming.

## Rules

1. **Preflight** — abort if not a git repo or no remote configured.
2. **Detect default branch**: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`, fallback `main`.
3. **Update**: `git fetch origin` then `git checkout {default}` and `git pull origin {default}`.
4. **Branch name** — ask user for intent, then build name as `{type}/{short-description}`:
   - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`.
   - Short description: lowercase, hyphens, no special characters.
   - Example: `feat/add-login-flow`, `fix/null-pointer-on-save`.
5. **Create and checkout**: `git checkout -b {branch}`.
6. **Summary**: branch name, based on which default branch, confirm ready to work.
