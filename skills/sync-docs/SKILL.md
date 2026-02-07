---
name: sync-docs
description: Create or update core repo docs from templates. Non-destructive.
---

Create at repo root if missing: README.md, AGENTS.md, docs/index.md, LICENSE.
Optional: CONTRIBUTING.md (only if user requests or repo is clearly open-source with multiple contributors).

Templates: `templates/` relative to this file.

## Rules

1. Repo root: `git rev-parse --show-toplevel`, fallback CWD.
2. Placeholders:
   - {{PROJECT_NAME}} → basename of repo root
   - {{DESCRIPTION}} → one-liner from package.json / Cargo.toml / pyproject.toml, or "TODO: add project description"
   - {{DATE}} → YYYY-MM-DD local
   - {{YEAR}} → four-digit year local
3. Populate from templates. Replace placeholders. Strip HTML comments from output.
   - AGENTS.md: fill "Repo map" with annotated key dirs/files (skip node_modules, .git, build artefacts). Fill "Orientation" from actual repo.
   - README.md: fill "Quickstart" from manifest scripts / Makefile / etc. If none found, use "TODO: add quickstart steps". "Structure" links to AGENTS.md#repo-map — don't duplicate.
   - LICENSE: if user specifies a licence, generate full standard text. Otherwise use template as-is.
   - docs/index.md: add CONTRIBUTING.md link only if created. Always include CHANGELOG.md — create the file at first release. Append links as deeper docs are added.
4. Create `docs/` dir if missing.
5. Skip existing files unless near-empty (≤ 3 non-blank lines) — replace and populate those.
6. Print summary: repo root, created, skipped, replaced-empty.
