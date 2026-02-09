---
name: ship-feature
description: Push current branch, create a PR, and after merge clean up and land back on the default branch
---

One command for the entire feature lifecycle. Detects current state and does the right thing.

## Rules

1. **Preflight** — run `check-preflight` skill.
2. **Detect default branch** — run `detect-default-branch` skill.
3. **Detect state** — determine which path to follow based on current branch and worktree.

### On the default branch

4. **Check for changes** — run `git status --porcelain`.
   - **Dirty worktree** — there is uncommitted work that belongs on a branch:
     1. Run `create-branch` skill to create a feature branch.
     2. Run `commit-changes` skill to stage and commit.
     3. Continue to the **open** path below (step 5 onward).
   - **Clean worktree** — nothing to ship. Print: "Nothing to ship. Ready for `/create-branch` or `/create-release`."

### On a feature branch

4. **Detect provider** — run `detect-provider` skill.
5. **Existing PR check** — run `detect-existing-pr` skill to determine current state.

#### If no PR exists — **open**

6. **Check for uncommitted changes** — if worktree is dirty, run `commit-changes` skill.
7. **Verify commits** — abort if no commits ahead of the default branch.
8. **Diff summary** — show `git diff --stat {default}..HEAD` and commit list so user can review what will be shipped.
9. **Push** — only after user approves. `git push -u origin {current_branch}`.
10. **PR title** — must be a valid Conventional Commit. Infer from branch name and commits; confirm with user.
11. **PR body** — generate from commits on the branch:
    - "## What" — concise summary of the change.
    - "## Changes" — bullet list from commit messages.
    - Confirm with user before creating.
12. **Draft** — ask user if PR should be opened as a draft. If yes, pass the draft flag (`--draft` for `gh`/`glab`; `"draft": true` for Gitea API).
13. **Create PR** targeting default branch. Set squash merge label/flag where supported.
14. **Summary**: PR URL, title, target branch, draft status. Remind user to run `/ship-feature` again after merge to land.

#### If PR exists and is still open — **wait**

6. **Print status** — show the PR URL and title.
7. **Summary**: PR is still open — merge it, then run `/ship-feature` again to land.

#### If PR exists and is merged — **land**

6. **Cleanup** — run `cleanup-branch` skill (auto-detects branch vs worktree mode and handles accordingly).
7. **Update** — `git fetch origin --prune` then `git pull origin {default}`.
8. **Summary**: landed on default branch, local branch deleted (and worktree removed if applicable), up to date. Suggest: run `/create-release` when ready to cut a version.
