---
name: create-pr
description: Push current branch and create a squash-merge PR targeting the default branch.
---

Create or re-use a PR from the current branch following AGENTS.md conventions.

## Canonical mechanism

The `git-pr` extension (`pi-extensions/git-pr/`) owns provider-aware PR creation through the `git_pr()` tool. This skill remains the human-facing workflow doc: it handles judgement around what to push, what title/body to use, and whether the PR should be draft.

```ts
git_pr({ title: string; body?: string; draft?: boolean })
```

`git_pr()` supports GitHub via `gh` and GitLab via `glab`; unsupported providers fail with a structured reason instead of guessing.

## Rules

1. **Preflight** — run `check-preflight` skill, then additionally abort if:
   - on the default branch (nothing to PR), or
   - no commits are ahead of the default branch.
2. **Detect default branch** — run `detect-default-branch` skill.
3. **Detect existing PR** — run `detect-existing-pr` skill. If it returns an existing PR:
   - if `state === "open"`, print the URL and stop;
   - if `state === "merged"`, tell the user to run `/ship` to land/cleanup;
   - if `state === "closed"`, warn that the previous PR was closed and ask before continuing.
4. **Show review context** — display `git diff --stat {default}..HEAD` and `git log --reverse --pretty=format:%h %s {default}..HEAD`.
5. **Push** — only after user approves: `git push -u origin {current_branch}`.
6. **PR title** — must be a valid Conventional Commit title (e.g. `feat: add login flow`). Default to the latest commit subject when appropriate; confirm with the user.
7. **PR body** — draft concise prose from the commits:
   - `## What` — one-paragraph summary.
   - `## Changes` — bullet list from commit messages.
   - `## Verification` — commands run or manual checks performed.
   Confirm with the user before creation.
8. **Draft** — ask whether to open as draft. Pass `draft: true` to `git_pr()` when requested.
9. **Create/re-use** — call `git_pr({ title, body, draft })`. If `details.reused === true`, report that the existing open PR was returned. If `isError === true`, surface `details.reason` and stop.
10. **Summary** — PR URL, number, title, target branch, draft status, and next step: merge on the host, then run `/ship` to land.

## Composes

- `check-preflight`
- `detect-default-branch`
- `detect-existing-pr`
- `pi-extensions/git-pr` (`git_pr()` canonical mechanism)
- `gh` / `glab` CLIs as the underlying provider transport
