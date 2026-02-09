---
name: detect-existing-pr
description: Check whether an open PR already exists for the current branch
---

Detect if an open pull/merge request already exists for the current branch on the remote.

## Rules

1. **Detect provider** — run `detect-provider` skill to determine the hosting provider and CLI.
2. **Query** by provider:
   - **GitHub**: `gh pr list --head {current_branch} --state open --json url,title --jq '.[0]'`.
   - **GitLab**: `glab mr list --source-branch {current_branch} --state opened -F json | jq '.[0]'`.
   - **Codeberg / Gitea**: `GET /api/v1/repos/{owner}/{repo}/pulls?state=open&head={owner}:{current_branch}` — take first result.
3. **Found** — if a PR exists, return its URL and title so the calling skill can skip creation or link to it.
4. **Not found** — return nothing; the calling skill may proceed to create a new PR.
