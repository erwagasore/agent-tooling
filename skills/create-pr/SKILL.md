---
name: create-pr
description: Push current branch and create a squash-merge PR targeting the default branch.
---

Create a PR from the current branch following AGENTS.md conventions.

## Rules

1. **Preflight** — run `check-preflight` skill, then additionally abort if:
   - On the default branch (nothing to PR).
   - No commits ahead of default branch.
2. **Detect default branch** — run `detect-default-branch` skill.
3. **Detect provider** — run `detect-provider` skill.
4. **Push** — only after user approves. `git push -u origin {current_branch}`.
5. **PR title** — must be a valid Conventional Commit (e.g. `feat: add login flow`). Infer from branch name and commits; confirm with user.
6. **PR body** — generate from commits on the branch:
   - "## What" — concise summary of the change.
   - "## Changes" — bullet list from commit messages.
   - Confirm with user before creating.
7. **Create PR** targeting default branch. Set squash merge label/flag where supported.
8. **Summary**: PR URL, title, target branch.
