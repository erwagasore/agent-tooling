---
name: create-release
description: Version, changelog, tag and push a release. Fully local — no CI required.
---

Create a release from the current state of the default branch.

## Rules

1. **Preflight** — abort if not a git repo or no remote configured.
2. **Switch to default branch**: detect via `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`, fallback `main`. If on a different branch, note it, then `git fetch origin --prune`, `git checkout {default}`, `git pull origin {default}`. If the previous branch was merged (remote branch deleted), delete it locally.
3. **Clean check** — abort if working tree is dirty or not up to date with remote.
4. **Current version** — determine from (in order):
   - Manifest: `package.json .version`, `Cargo.toml [package] version`, `pyproject.toml [project] version`, or similar.
   - Latest git tag matching `vX.Y.Z`.
   - If neither exists, assume `0.0.0`.
5. **Analyse commits** since last release tag. Read each commit message and classify:
   - `fix:` → patch
   - `feat:` → minor
   - `feat!:` or `BREAKING CHANGE` in body → major
   - Other prefixes → no bump
   - Highest bump wins.
   - If no bump-worthy commits found, ask user whether to proceed or abort.
6. **Next version** — increment current version per semver. Confirm with user.
7. **Changelog** — prepend a new section to `CHANGELOG.md` (create file if missing):
   - Header: `## [X.Y.Z] — YYYY-MM-DD`
   - Group entries under: `### Breaking Changes`, `### Features`, `### Fixes`, `### Other` (omit empty groups).
   - Write human-readable summaries from commit messages — don't just copy raw messages.
   - Confirm with user before writing.
8. **Update manifest** — if a manifest file exists, update its version to the new value.
9. **Commit**: `git commit -am "chore: release vX.Y.Z"`.
10. **Tag**: `git tag -a vX.Y.Z -m "vX.Y.Z"` (annotated, so `--follow-tags` pushes it).
11. **Push** — only after user approves. `git push origin {default} --follow-tags`.
12. **GitHub/GitLab/Gitea release** — if provider supports it, create a release from the tag using the changelog section as notes. Use `gh release create` (GitHub), `glab release create` (GitLab), or the Gitea API.
13. **Summary**: version (old → new), changelog entries, tag, files updated.
