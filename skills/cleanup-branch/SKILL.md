---
name: cleanup-branch
description: Delete the current local branch if it has been merged and its remote branch is gone
---

Clean up a stale local branch after its PR has been merged.

## Rules

1. **Skip** — if the current branch is the default branch, do nothing.
2. **Check remote** — run `git ls-remote --heads origin {current_branch}`. If the remote branch still exists, do nothing.
3. **Detect mode** — compare `git rev-parse --git-common-dir` with `git rev-parse --git-dir`. If they differ, this is a worktree.
4. **Switch away**:
   - Worktree mode: note the worktree path, then `cd` to the main working tree (`git rev-parse --git-common-dir`/.. ) and run `git worktree remove {path}`.
   - Branch mode: check out the default branch (use `detect-default-branch` skill to resolve it).
5. **Delete** — run `git branch -d {previous_branch}`. If `-d` fails (not fully merged), do not force-delete — warn and leave the branch.
6. **Return** — report whether the branch was deleted or skipped, and which mode was used.
