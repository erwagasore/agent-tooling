---
name: detect-provider
description: Detect the git hosting provider and corresponding CLI from the remote URL
---

Identify the git hosting provider and its CLI tool from the origin remote.

## Rules

1. **Call** the `git_context` tool.
2. **Provider** — `details.provider` is one of `"github"`, `"gitlab"`, `"bitbucket"`, or `"unknown"`.
3. **CLI mapping**:
   - `github` → `gh`
   - `gitlab` → `glab`
   - `bitbucket` → no first-class CLI; use the HTTP API
   - `unknown` → ask the user which provider and CLI to use

Backing extension: `pi-extensions/git-context`.
