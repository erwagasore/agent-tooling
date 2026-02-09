---
name: detect-provider
description: Detect the git hosting provider and corresponding CLI from the remote URL
---

Identify the git hosting provider and its CLI tool from the origin remote.

## Rules

1. **Read remote** — run `git remote get-url origin`.
2. **Match hostname**:
   - `github.com` → provider **GitHub**, CLI `gh`.
   - `gitlab.com` → provider **GitLab**, CLI `glab`.
   - `codeberg.org` → provider **Codeberg (Gitea)**, CLI uses Gitea API.
3. **Unknown** — if hostname doesn't match any known provider, ask the user.
4. **Return** — use the resolved provider name and CLI tool wherever the calling skill needs them.
