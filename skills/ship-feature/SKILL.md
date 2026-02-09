---
name: ship-feature
description: Push current branch, create a PR, and after merge clean up and land back on the default branch
---

End-to-end feature delivery — run once to open a PR, run again after merge to land.

## Rules

1. **Preflight** — run `check-preflight` skill.
2. **Detect default branch** — run `detect-default-branch` skill. Abort if already on the default branch.
3. **Detect provider** — run `detect-provider` skill.
4. **Existing PR check** — run `detect-existing-pr` skill to determine current state.

### If no PR exists — **open**

5. **Clean check** — run `check-worktree` skill.
6. **Verify commits** — abort if no commits ahead of the default branch.
7. **Diff summary** — show `git diff --stat {default}..HEAD` and commit list so user can review what will be shipped.
8. **Push** — only after user approves. `git push -u origin {current_branch}`.
9. **PR title** — must be a valid Conventional Commit. Infer from branch name and commits; confirm with user.
10. **PR body** — generate from commits on the branch:
    - "## What" — concise summary of the change.
    - "## Changes" — bullet list from commit messages.
    - Confirm with user before creating.
11. **Draft** — ask user if PR should be opened as a draft. If yes, pass the draft flag (`--draft` for `gh`/`glab`; `"draft": true` for Gitea API).
12. **Create PR** targeting default branch. Set squash merge label/flag where supported.
13. **Summary**: PR URL, title, target branch, draft status. Remind user to run `/ship-feature` again after merge to land.

### If PR exists and is still open — **wait**

5. **Print status** — show the PR URL and title.
6. **Summary**: PR is still open — merge it, then run `/ship-feature` again to land.

### If PR exists and is merged — **land**

5. **Cleanup** — run `cleanup-branch` skill to delete the local branch and switch to the default branch.
6. **Update** — `git fetch origin --prune` then `git pull origin {default}`.
7. **Summary**: landed on default branch, local branch deleted, up to date. Suggest: run `/create-release` when ready to cut a version.
