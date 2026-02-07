---
name: create-release
description: Version, changelog, tag and push a release. Fully local — no CI required.
---

Create a release from the current state of the default branch.

## Rules

1. **Preflight** — abort if:
   - Not a git repo or no remote configured.
   - Not on the default branch.
   - Working tree is dirty (uncommitted changes).
   - Not up to date with remote (`git fetch origin` then compare).
2. **Current version** — determine from (in order):
   - Manifest: `package.json .version`, `Cargo.toml [package] version`, `pyproject.toml [project] version`, or similar.
   - Latest git tag matching `vX.Y.Z`.
   - If neither exists, assume `0.0.0`.
3. **Analyse commits** since last release tag. Read each commit message and classify:
   - `fix:` → patch
   - `feat:` → minor
   - `feat!:` or `BREAKING CHANGE` in body → major
   - Other prefixes → no bump
   - Highest bump wins.
   - If no bump-worthy commits found, ask user whether to proceed or abort.
4. **Next version** — increment current version per semver. Confirm with user.
5. **Changelog** — prepend a new section to `CHANGELOG.md` (create file if missing):
   - Header: `## [X.Y.Z] — YYYY-MM-DD`
   - Group entries under: `### Breaking Changes`, `### Features`, `### Fixes`, `### Other` (omit empty groups).
   - Write human-readable summaries from commit messages — don't just copy raw messages.
   - Confirm with user before writing.
6. **Update manifest** — if a manifest file exists, update its version to the new value.
7. **Commit**: `git commit -am "chore: release vX.Y.Z"`.
8. **Tag**: `git tag -a vX.Y.Z -m "vX.Y.Z"` (annotated, so `--follow-tags` pushes it).
9. **Push** — only after user approves. `git push origin {default} --follow-tags`.
10. **GitHub/GitLab/Gitea release** — if provider supports it, create a release from the tag using the changelog section as notes. Use `gh release create` (GitHub), `glab release create` (GitLab), or the Gitea API.
11. **Summary**: version (old → new), changelog entries, tag, files updated.
