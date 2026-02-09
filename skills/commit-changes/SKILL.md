---
name: commit-changes
description: Stage and commit working tree changes with a Conventional Commit message
---

Stage all changes and commit with a well-formed Conventional Commit message.

## Rules

1. **Branch guard** — run `detect-default-branch` skill. If the current branch is the default branch, abort: "Cannot commit on the default branch. Run `/create-branch` first."
2. **Check** — run `git status --porcelain`. If empty, nothing to commit — return.
3. **Show changes** — display `git diff --stat` and list of untracked files so the user can review what will be committed.
4. **Stage** — `git add -A`.
5. **Commit message** — build a Conventional Commit message:
   - Infer the type and description from the changed files and diff context.
   - Must follow the format: `type: description` (e.g. `feat: add login flow`).
   - Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`.
   - Append `!` after type for breaking changes (e.g. `feat!: new auth API`).
   - Confirm with user before committing.
6. **Commit** — `git commit -m "{message}"`.
7. **Return** — report the commit hash and message.
