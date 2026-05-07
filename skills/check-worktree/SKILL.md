---
name: check-worktree
description: Verify the git working tree is clean with no uncommitted changes
---

Abort early if there are uncommitted changes in the working tree.

## Rules

1. **Call** the `git_guard` tool with `{ requireClean: true }`.
2. **Clean** — if `details.ok === true`, the calling skill may proceed.
3. **Dirty** — if `isError === true`, abort the calling skill and surface the failure message: the worktree must be committed or stashed before proceeding.

Backing extension: `pi-extensions/git-guard`.
