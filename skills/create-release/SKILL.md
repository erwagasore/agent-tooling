---
name: create-release
description: Version, changelog, tag and push a release. Fully local — no CI required.
---

Cut a release from the current state of the default branch.

## Canonical implementation

The `git-release` extension (`pi-extensions/git-release/`) is the canonical implementation. Invoke it via the `/release` slash command. This skill exists as the human-facing doc.

```
/release status            → preview only: bump, next version, draft changelog
/release                   → apply (uses computed bump from CC log)
/release patch|minor|major → apply with explicit bump override
```

## What `/release` does

1. **Preflight** — must be on the default branch with a clean worktree.
2. **Read latest tag** matching `vX.Y.Z` (or fall back to `0.0.0`).
3. **Walk commits** since that tag and classify each as `feat` / `fix` / `feat!` / other.
4. **Compute bump** — `feat!` or `BREAKING CHANGE` → major; `feat` → minor; `fix` → patch; nothing bump-worthy → fail and ask for an override.
5. **Draft changelog** — a `## [X.Y.Z] — YYYY-MM-DD` section grouped under `### Breaking Changes`, `### Features`, `### Fixes`, `### Other` (omitting empty groups).
6. **Confirm** the release with the user before any mutation.
7. **Bump `package.json`** (if present), **prepend `CHANGELOG.md`**, commit `chore: release vX.Y.Z`, tag annotated.
8. **Confirm push**, then `git push origin {default} --follow-tags`.
9. **Provider release** via `gh release create` (GitHub) or `glab release create` (GitLab); the changelog section becomes the release notes.

## Notes

- **Manifest support** is currently `package.json` only. `Cargo.toml`, `pyproject.toml`, etc. can be added in `bumpManifest` when needed.
- **Pre-releases** (`-alpha.1`, `-rc.1`, …) are not yet supported via the slash command. Tag manually for those, or extend `applyBump`.
- **Changelog wording**: the auto-generated bullets strip the CC type prefix and capitalise the description. Edit `CHANGELOG.md` after the run if you want richer prose; commit the polish as a follow-up `docs(changelog)` PR.

## Composes

- `pi-extensions/git-release` (canonical)
- `pi-extensions/_shared/git-internals` (provider detection, default branch resolution, command running)
- `gh` / `glab` CLIs for the provider release step
