---
name: cleanup-branch
description: Delete the current local branch if its remote branch is gone (post-merge cleanup)
---

Clean up a stale local branch after its PR has been merged and the remote branch deleted.

## Rules

1. **Call** the `git_context` tool to read `currentBranch`, `defaultBranch`, and `mode`.
2. **Skip** — if `currentBranch === defaultBranch`, do nothing.
3. **Check remote** — run `git ls-remote --heads origin {currentBranch}`. If non-empty, the remote branch still exists; do nothing.
4. **Switch away**:
   - `mode === "worktree"`: `cd` to the main working tree (`git rev-parse --git-common-dir`/..) then run `git worktree remove {path}`.
   - `mode === "branch"`: check out `defaultBranch`.
5. **Delete** — run `git branch -d {previous_branch}`. If `-d` refuses (squash-merged branches look unmerged to git), retry with `-D` since step 3 already confirmed the remote is gone.
6. **Return** — report whether the branch was deleted and which mode was used.

Backing extension: `pi-extensions/git-context` (state); plain git for the mutations.
