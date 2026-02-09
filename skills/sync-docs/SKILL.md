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
3. **Create** — for missing or near-empty (≤ 3 non-blank lines) files:
   - Populate from templates. Replace placeholders. Strip HTML comments from output.
   - AGENTS.md: fill "Repo map" and "Orientation" per scanning rules below.
   - README.md: fill "Quickstart" per scanning rules below. "Structure" links to AGENTS.md#repo-map — don't duplicate.
   - LICENSE: if user specifies a licence, generate full standard text. Otherwise use template as-is.
   - docs/index.md: populate per scanning rules below.
4. Create `docs/` dir if missing.
5. **Sync** — for existing files with > 3 non-blank lines, update only **repo-derived sections** in-place. Everything else is authored and must not be touched.

### Repo-derived sections

Each section below must be regenerated from the current repo state on every sync. To update: find the section heading, replace all content between it and the next heading of equal or higher level.

#### AGENTS.md — `## Repo map`

Scan the repo tree (skip `.git`, `node_modules`, `dist`, `build`, `__pycache__`, `.next`, and similar build artefacts). List key directories and notable files with a one-line annotation each:
- For directories containing a `SKILL.md`: read the frontmatter `description` (or first non-blank content line) for the annotation.
- For extension directories: read the entry-file doc comment or module-level description for the annotation.
- For other directories: infer purpose from name, contents, or any manifest/readme present.
- Don't list every file — focus on directories and files that help a newcomer navigate.

#### AGENTS.md — `## Orientation`

Regenerate from repo analysis:
- **Entry point**: the primary directory or file a user/contributor interacts with first.
- **Domain**: one-liner on what the repo is about.
- Include tech stack, language, or framework when relevant.

#### README.md — `## Quickstart`

Scan the repo and build setup + usage instructions:
1. Clone step (always).
2. For each top-level component directory that users install or symlink (e.g. `skills/`, `pi-extensions/`), add the appropriate setup step.
3. List available components grouped by kind:
   - **Skills**: scan `skills/*/SKILL.md` — list each as `/<name> — <description>`.
   - **Extensions**: scan `pi-extensions/*/` — read entry-file doc comment or infer from directory name — list each as `**<name>** — <description>`.
4. If a manifest (`package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml`) defines user-facing scripts or targets, include relevant run/build/test commands.
5. If nothing actionable is found for a sub-section, use "TODO: add …" as placeholder.

#### docs/index.md — full content

Regenerate the entire link list:
- Always link: README.md, AGENTS.md, LICENSE, CHANGELOG.md.
- Conditionally link CONTRIBUTING.md only if the file exists.
- Scan `docs/` for any additional `.md` files and append links for each.

### Authored sections (never modified)

Everything not listed above, including but not limited to:
- AGENTS.md: Workflow, Commits, Releases, Merge strategy, Definition of done.
- README.md: project title, description line, Structure.
- LICENSE (entire file once populated).
- CONTRIBUTING.md (entire file).

6. Print summary: repo root, files created, files updated (list which sections changed), files skipped (no changes needed).
