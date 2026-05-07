---
name: detect-existing-pr
description: Check whether a PR already exists for the current branch
---

Detect if a pull/merge request already exists for the current branch on the remote.

## Rules

1. **Call** the `git_context` tool.
2. **Found** — if `details.existingPr` is non-null, return its `number`, `url`, and `state` so the calling skill can skip creation or link to it.
3. **Not found** — if `details.existingPr` is null, the calling skill may proceed to create a new PR.
4. **Filter by state** — `git_context` returns the latest PR regardless of state (`open`, `merged`, `closed`). The calling skill should filter on `state` if it only cares about open PRs.

Backing extension: `pi-extensions/git-context`. Uses `gh pr list` for GitHub and `glab mr list` for GitLab; missing CLIs surface as `warnings` rather than failures.
