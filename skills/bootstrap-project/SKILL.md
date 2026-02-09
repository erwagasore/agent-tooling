---
name: bootstrap-project
description: Initialise a new project end-to-end — repo, docs, and first working branch
---

Full day-one project setup by composing init-repo, sync-docs, and create-branch.

## Rules

1. **Init repo** — run `init-repo` skill (git init, .gitignore, initial commit, remote creation, branch protection).
2. **Sync docs** — run `sync-docs` skill (README, AGENTS, LICENSE, docs/index — populated from templates).
3. **Commit docs** — if sync-docs created or updated any files, stage and commit: `git add -A && git commit -m "docs: bootstrap repo documentation"`.
4. **Push docs** — only after user approves. `git push origin {default}`.
5. **First branch** — ask user if they want to start a working branch. If yes, run `create-branch` skill.
6. **Summary**: repo URL, provider, default branch, files created, working branch (if created). Project is ready.
