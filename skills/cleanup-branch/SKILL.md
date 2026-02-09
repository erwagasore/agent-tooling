---
name: cleanup-branch
description: Delete the current local branch if it has been merged and its remote branch is gone
---

Clean up a stale local branch after its PR has been merged.

## Rules

1. **Skip** — if the current branch is the default branch, do nothing.
2. **Check remote** — run `git ls-remote --heads origin {current_branch}`. If the remote branch still exists, do nothing.
3. **Switch away** — check out the default branch (use `detect-default-branch` skill to resolve it).
4. **Delete** — run `git branch -d {previous_branch}`. If `-d` fails (not fully merged), do not force-delete — warn and leave the branch.
5. **Return** — report whether the branch was deleted or skipped.
