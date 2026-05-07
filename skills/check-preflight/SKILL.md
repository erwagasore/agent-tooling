---
name: check-preflight
description: Validate that the current directory is a git repo with a remote configured
---

Run standard preflight checks before any git-based skill proceeds.

## Rules

1. **Call** the `git_guard` tool with `{ requireRemote: true }`.
2. **Pass** — if `details.ok === true`, the calling skill may proceed.
3. **Fail** — if `isError === true`, abort the calling skill and surface the failure message from `details.failures` (covers both "not a git repository" and "no origin remote configured").

Backing extension: `pi-extensions/git-guard`.
