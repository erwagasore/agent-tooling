---
name: check-worktree
description: Verify the git working tree is clean with no uncommitted changes
---

Abort early if there are uncommitted changes in the working tree.

## Rules

1. **Check** — run `git status --porcelain`. If output is non-empty, the worktree is dirty.
2. **Dirty** — list the changed files and abort: "Working tree is dirty. Commit or stash changes before proceeding."
3. **Clean** — if output is empty, the calling skill may proceed.
