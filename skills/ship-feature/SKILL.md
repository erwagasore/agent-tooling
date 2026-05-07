---
name: ship-feature
description: Push current branch, create a PR, and after merge clean up and land back on the default branch
---

One command for the entire feature lifecycle. Detects the current state and runs the right phase.

## Canonical implementation

The `git-ship` extension (`pi-extensions/git-ship/`) is the canonical implementation. Invoke it via the `/ship` slash command. This skill exists as the human-facing doc.

```
/ship           → detect state, run the right phase
/ship status    → detect state, print only, run nothing
```

## States

| State | Trigger | Action |
|---|---|---|
| `default-clean` | on default branch, worktree clean | Print "nothing to ship". |
| `default-dirty` | on default branch, worktree dirty | Print "create a branch first". |
| `no-pr` | on feature branch, no existing PR | Show diff + commits, confirm, push, prompt for title (default = last commit subject), auto-derive body, create PR via `gh`/`glab`, print URL. |
| `pr-open` | on feature branch, PR open | Print URL, exit — wait for merge then run `/ship` again. |
| `pr-merged` | on feature branch, PR merged | Cleanup the local branch and (if the cwd is a linked worktree) remove and prune it via the shared `removeWorktree` helper that backs `/wt land`; then `git fetch --prune` and `git pull` default. |
| `pr-closed` | on feature branch, PR closed without merge | Print warning. |

## Behaviour notes

- **Confirm before push.** The user is asked to approve before any push, per AGENTS.md.
- **Conventional Commit titles.** Default PR title = latest commit subject; user can override at the prompt.
- **Squash-merge cleanup.** After confirming the remote branch is gone, `git branch -d` falls through to `-D` since squash-merged branches look unmerged to git.
- **Provider support.** GitHub via `gh`, GitLab via `glab`. Other providers print a warning and stop.

## Composes

- `pi-extensions/git-ship` (canonical)
- `pi-extensions/_shared/git-internals` (state detection, PR detection/creation, worktree removal)
- `pi-extensions/git-pr` shares the same `createPr` helper for PR creation
- `pi-extensions/git-worktree` shares the same `removeWorktree` helper for the pr-merged worktree path
- `gh` / `glab` CLIs are still the underlying transport
