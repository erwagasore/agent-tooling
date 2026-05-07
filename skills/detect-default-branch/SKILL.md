---
name: detect-default-branch
description: Detect the default branch of the current git repository
---

Resolve the default branch name for the current repo.

## Rules

1. **Call** the `git_context` tool.
2. **Return** `details.defaultBranch` for the calling skill.

Backing extension: `pi-extensions/git-context`. The extension probes `symbolic-ref refs/remotes/origin/HEAD`, falls back to parsing `git remote show origin`, then to local `main`/`master`, and finally defaults to `"main"`.
