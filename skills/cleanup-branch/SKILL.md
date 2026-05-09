---
name: cleanup-branch
description: Delete the current local branch if its remote branch is gone (post-merge cleanup)
---

Clean up a stale local branch after its PR has been merged and the remote branch deleted.

## Scope

This utility is a low-level cleanup building block. For normal feature delivery, prefer the canonical lifecycle command:

```bash
/ship
```

`/ship` detects merged PR state, handles branch-vs-worktree mode, and lands on the default branch using the same shared cleanup helpers as the worktree extension.

For manual linked-worktree removal, prefer:

```bash
/wt land
```

`/wt land` performs the current safety checks: it refuses the main worktree, refuses dirty or unknown-cleanliness worktrees, removes only the worktree directory, preserves the branch, and prints a `cd "<path>"` hint because pi cannot change the user's shell directory.

## Rules

1. **Call** the `git_context` tool to read `currentBranch`, `defaultBranch`, and `mode`.
2. **Skip** — if `currentBranch === defaultBranch`, do nothing.
3. **Check remote** — run `git ls-remote --heads origin {currentBranch}`. If non-empty, the remote branch still exists; do nothing.
4. **Branch mode cleanup** — if `mode === "branch"`:
   - check out `defaultBranch`;
   - run `git branch -d {previous_branch}`;
   - if `-d` refuses, retry with `-D` because step 3 already confirmed the remote branch is gone and squash-merged branches look unmerged to git.
5. **Worktree mode guidance** — if `mode === "worktree"`, do not pretend to `cd` for the user. Tell the user to run `/ship` for post-merge landing or `/wt land` for manual linked-worktree removal. If a caller performs worktree removal directly, it must preserve `/wt land` safety semantics: refuse dirty/unknown-cleanliness worktrees, refuse the main worktree, remove only the worktree directory, and print the `cd` target back to the main repo.
6. **Return** — report whether anything was deleted and which path was recommended or used.

Backing extensions: `pi-extensions/git-context` for state; `pi-extensions/git-ship` and `pi-extensions/git-worktree` are the canonical high-level cleanup entry points for post-merge and manual worktree paths.
