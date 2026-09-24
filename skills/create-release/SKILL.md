---
name: create-release
description: Version, changelog, tag and push a release. Fully local — no CI required.
---

Cut a release from the current state of the default branch.

## Canonical implementation

The `git-release` extension (`pi-extensions/git-release/`) is the canonical implementation. Invoke it via the `/release` slash command. This skill exists as the human-facing doc.

```
/release status                                      → preview only
/release                                             → computed stable release, or promote current pre-release
/release patch|minor|major                           → stable release with an explicit bump
/release prerelease <identifier> [patch|minor|major] → pre-release such as `rc.1`
/release status prerelease <identifier> [bump]       → preview a pre-release
```

## What `/release` does

1. **Preflight** — must be on the default branch with a clean worktree.
2. **Read latest tag** matching `vX.Y.Z` or `vX.Y.Z-identifier.N` (or fall back to `0.0.0`).
3. **Walk commits** since that tag and classify each as `feat` / `fix` / `feat!` / other.
4. **Compute bump** — `feat!` or `BREAKING CHANGE` → major; `feat` → minor; `fix` → patch; nothing bump-worthy → fail and ask for an override. For `prerelease <identifier>`, start at `<identifier>.1`; repeating the same identifier increments its sequence without bumping the base again (`rc.1` → `rc.2`). An explicit bump always starts that bumped base, even from an existing pre-release.
5. **Draft changelog** — a `## [X.Y.Z[-identifier.N]] — YYYY-MM-DD` section grouped under `### Breaking Changes`, `### Features`, `### Fixes`, `### Other` (omitting empty groups).
6. **Confirm** the release with the user before any mutation.
7. **Detect the project root and language/ecosystem signals**, then bump supported writable version fields using built-in adapters plus safe generic root-manifest inference, **prepend `CHANGELOG.md`**, commit `chore: release vX.Y.Z[-identifier.N]`, tag annotated.
8. **Confirm push**, then `git push origin {default} --follow-tags`.
9. **Provider release** via `gh release create` (GitHub) or `glab release create` (GitLab); the changelog section becomes the release notes.

## Notes

- **Manifest support** is adaptive: `/release` detects the project root, infers ecosystems from root marker files, applies high-confidence built-ins (including npm lockfile synchronization), then uses a safe generic fallback for root-level manifest-like files only when exactly one semver-like version field is found. Ambiguous files are left untouched.
- **Pre-releases** use `/release prerelease <identifier>`, for example `/release prerelease alpha minor` followed later by `/release prerelease alpha` to advance `alpha.1` to `alpha.2`. Changing identifiers without an explicit bump keeps the base version and resets the sequence to `.1`; an explicit bump starts a new base. Run plain `/release` to promote the latest pre-release to its matching stable version (`rc.2` → stable), even when there are no new bump-worthy commits.
- **Changelog wording**: the auto-generated bullets strip the CC type prefix and capitalise the description. Edit `CHANGELOG.md` after the run if you want richer prose; commit the polish as a follow-up `docs(changelog)` PR.

## Composes

- `pi-extensions/git-release` (canonical)
- `pi-extensions/_shared/git-internals` (provider detection, default branch resolution, command running)
- `gh` / `glab` CLIs for the provider release step
