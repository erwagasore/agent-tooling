---
name: check-preflight
description: Validate that the current directory is a git repo with a remote configured
---

Run standard preflight checks before any git-based skill proceeds.

## Rules

1. **Git repo** — run `git rev-parse --git-dir`. If it fails, abort: "Not a git repository."
2. **Remote configured** — run `git remote`. If empty, abort: "No remote configured."
3. **Pass** — if both checks pass, the calling skill may proceed.
