---
name: init-repo
description: Initialise git repo, create remote if needed, configure branch protection and merge settings.
---

Ensure the current directory is a fully configured git repo with branch protection.

## Rules

1. **Git init** — if not a git repo (`git rev-parse --git-dir` fails), run `git init`.
2. **Initial commit** — if no commits exist (`git rev-parse HEAD` fails), create an empty initial commit: `git commit --allow-empty -m "Initial commit"`.
3. **Remote** — if no remote configured (`git remote` is empty), gather:
   - **Provider**: ask user (GitHub, GitLab, Codeberg). Skip if only one CLI is installed.
   - **Owner**: ask user (personal account or organisation/group). Default to authenticated user.
   - **Repo name**: ask user. Default to directory basename.
   - **Visibility**: ask user (private or public). Default to private.
   - Verify required CLI is available (`gh`, `glab`, or `tea`). Abort if missing.
   - Create remote repo, add as `origin`, push default branch.
4. **Detect provider** — run `detect-provider` skill.
5. **Detect default branch** — run `detect-default-branch` skill.
6. **Apply protection** on the default branch. Skip if equivalent already exists.
7. **Summary**: repo, provider, owner, branch, what was created/skipped.

## Provider details

**GitHub** (`gh` CLI):
- Create: `gh repo create {owner}/{name} --source . --push --private|--public`.
- Ruleset "Protect {branch}": require PRs (0 approvals), dismiss stale reviews, block deletion and force push. Bypass: repo owner (`actor_id: 5`, `actor_type: RepositoryRole`).
- Merge: squash only, PR title/body as commit message, auto-delete head branch.

**GitLab** (`glab` CLI or `GITLAB_TOKEN`):
- Create: `glab repo create {owner}/{name} --private|--public`.
- Protected branch: no direct push (maintainers via MR only), block force push.
- Project: `squash_option: always`, `merge_method: merge`, auto-delete source branch.

**Codeberg / Gitea** (`GITEA_TOKEN`):
- Create: POST `/api/v1/orgs/{owner}/repos` (org) or `/api/v1/user/repos` (personal) with `name`, `private`.
- Branch protection via `/api/v1/repos/{owner}/{name}/branch_protections`: restrict push, require PR, block deletion and force push.
- Repo: default merge style `squash`, auto-delete head branch.
