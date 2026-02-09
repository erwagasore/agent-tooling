---
name: detect-default-branch
description: Detect the default branch of the current git repository
---

Determine the default branch name from the remote and return it.

## Rules

1. **Detect** — run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` and extract the branch name (strip `refs/remotes/origin/` prefix).
2. **Fallback** — if the command fails or returns empty, fall back to `main`.
3. **Return** — use the resolved branch name wherever the calling skill needs it.
