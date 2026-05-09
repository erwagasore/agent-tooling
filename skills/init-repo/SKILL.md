---
name: init-repo
description: Initialise git repo, create remote if needed, configure branch protection and merge settings.
---

Ensure the current directory is a fully configured git repo with branch protection.

## Provider support boundary

This skill can guide initial remote setup for several providers, but the automated `git-*` extension surface is narrower:

| Provider | init-repo guidance | `git-pr` / `/ship` PRs | `/release` provider notes |
|---|---:|---:|---:|
| GitHub | automated via `gh` | supported via `gh` | supported via `gh release create` |
| GitLab | automated via `glab` | supported via `glab` | supported via `glab release create` |
| Bitbucket | not created automatically here | detected only, not created | detected only, no provider notes |
| Codeberg / Gitea | manual/API guidance only | not supported by `git-pr` yet | no provider notes |

If the user chooses a provider outside GitHub/GitLab, be explicit that later PR/release automation may stop with a structured unsupported-provider message and the user may need to use the host UI manually.

## Rules

1. **Git init** — if not a git repo (`git rev-parse --git-dir` fails), run `git init`.
2. **Gitignore** — if no `.gitignore` exists, detect the project language/framework from manifests (`package.json` → Node, `Cargo.toml` → Rust, `pyproject.toml` / `setup.py` → Python, `go.mod` → Go, etc.) and generate an appropriate `.gitignore`. If no manifest is detected, ask the user. Skip if `.gitignore` already exists.
3. **Initial commit** — if no commits exist (`git rev-parse HEAD` fails), stage all files and create an initial commit: `git add -A && git commit -m "Initial commit"`.
4. **Remote** — if no remote is configured (`git remote` is empty), gather:
   - **Provider**: ask user. Prefer GitHub or GitLab for full automation; explain that Bitbucket/Codeberg/Gitea currently require manual follow-up for PR/release automation.
   - **Owner**: ask user (personal account or organisation/group). Default to authenticated user when the provider CLI can report it.
   - **Repo name**: ask user. Default to directory basename.
   - **Visibility**: ask user (private or public). Default to private.
   - Verify required automation is available for the selected provider. For GitHub/GitLab, require `gh`/`glab`. For providers without implemented automation, stop after giving manual setup steps unless the user explicitly asks to continue manually.
   - Create remote repo where automated support exists, add as `origin`, and push the default branch after user approval.
5. **Detect provider** — run `detect-provider` skill. If it returns `bitbucket` or `unknown`, note that the rest of the `git-*` automation may be limited.
6. **Detect default branch** — run `detect-default-branch` skill.
7. **Apply protection** on the default branch where automated provider support exists. Skip if equivalent already exists; otherwise print manual branch-protection instructions.
8. **Summary**: repo, provider, owner, branch, what was created/skipped, and what automation is supported. Suggest next steps: run `sync-docs` to generate documentation, then `create-branch` to start working.

## Provider details

**GitHub** (`gh` CLI):
- Create: `gh repo create {owner}/{name} --source . --push --private|--public`.
- Ruleset "Protect {branch}": require PRs (0 approvals), dismiss stale reviews, block deletion and force push. Bypass: repo owner (`actor_id: 5`, `actor_type: RepositoryRole`).
- Merge: squash only, PR title/body as commit message, auto-delete head branch.
- Downstream automation: `git-pr`, `/ship`, and `/release` provider notes are supported.

**GitLab** (`glab` CLI or `GITLAB_TOKEN`):
- Create: `glab repo create {owner}/{name} --private|--public`.
- Protected branch: no direct push (maintainers via MR only), block force push.
- Project: `squash_option: always`, `merge_method: merge`, auto-delete source branch.
- Downstream automation: `git-pr`, `/ship`, and `/release` provider notes are supported.

**Bitbucket**:
- Current `git-*` support detects Bitbucket remotes but does not create PRs or provider release notes automatically.
- Use manual remote creation and host UI workflows until Bitbucket support is implemented.

**Codeberg / Gitea**:
- Manual/API setup can be performed when the user explicitly asks for it and provides the required host URL/token.
- Current `git-*` support does not detect these providers or create PRs/provider release notes automatically.
- Use manual host UI workflows until Gitea/Codeberg provider support is implemented.
