---
name: commit-changes
description: Stage and commit working tree changes with a Conventional Commit message
---

Stage all changes and commit with a well-formed Conventional Commit message.

## Rules

1. **Check** — run `git status --porcelain`. If empty, nothing to commit — return.
2. **Show changes** — display `git diff --stat` and list of untracked files so the user can review what will be committed.
3. **Stage** — `git add -A`.
4. **Commit message** — build a Conventional Commit message:
   - Infer the type and description from the changed files and diff context.
   - Must follow the format: `type: description` (e.g. `feat: add login flow`).
   - Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`.
   - Append `!` after type for breaking changes (e.g. `feat!: new auth API`).
   - Confirm with user before committing.
5. **Commit** — `git commit -m "{message}"`.
6. **Return** — report the commit hash and message.
