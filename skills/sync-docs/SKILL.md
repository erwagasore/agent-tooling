---
name: sync-docs
description: Create or update core repo docs from templates. Non-destructive.
---

Create at repo root if missing: README.md, AGENTS.md, docs/index.md, LICENSE.
Optional: CONTRIBUTING.md (only if user requests or repo is clearly open-source with multiple contributors).

Templates: `templates/` relative to this file.

## Document hierarchy

Every project gets AGENTS.md. Additional docs are created only when needed:

```
Every project:
  └── AGENTS.md (always)

Does the project have complex architecture, conventions, or structure
that would bloat AGENTS.md past ~100 lines of rules?
  ├── No  → AGENTS.md is enough
  └── Yes → + SPEC.md

Does the project have enumerated taxonomies or controlled vocabularies?
  ├── No  → done
  └── Yes → + REFERENCE.md
```

| File | When to create |
|---|---|
| AGENTS.md | Always |
| SPEC.md | Complex architecture, conventions, or structure that would bloat AGENTS.md past ~100 lines |
| REFERENCE.md | Enumerated taxonomies or controlled vocabularies (lookup tables, category lists, code mappings) |
| TODO.md | Orthogonal — use when needed, not managed by sync-docs |

### Retired files — migration

ARCHITECTURE.md and CONVENTIONS.md are retired. Their content belongs in SPEC.md.

- If the repo contains an existing **ARCHITECTURE.md** or **CONVENTIONS.md**: show the user a summary of what will be merged, confirm, then fold content into SPEC.md and delete the originals.
- Never create new ARCHITECTURE.md or CONVENTIONS.md files.

## Rules

1. Repo root: `git rev-parse --show-toplevel`, fallback CWD.
2. Placeholders:
   - {{PROJECT_NAME}} → basename of repo root
   - {{DESCRIPTION}} → one-liner from package.json / Cargo.toml / pyproject.toml, or "TODO: add project description"
   - {{OWNER}} → repository owner from `git remote get-url origin`, or ask user if not determinable
   - {{DATE}} → YYYY-MM-DD local
   - {{YEAR}} → four-digit year local
3. **Create** — for missing or near-empty (≤ 3 non-blank lines) files:
   - If the file exists with 1–3 non-blank lines, show its current content and confirm with the user before overwriting.
   - Populate from templates. Replace placeholders. Strip HTML comments from output.
   - AGENTS.md: fill "Repo map" and "Orientation" per scanning rules below.
   - SPEC.md: only create when the decision tree calls for it (see above). Populate architecture and conventions sections from repo analysis.
   - REFERENCE.md: only create when the decision tree calls for it (see above). Populate with discovered taxonomies.
   - README.md: fill "Quickstart" per scanning rules below. Use stable `sync-docs:*` generated markers for repo-derived command/component sections so future syncs can update them without touching authored prose. "Structure" links to AGENTS.md#repo-map — don't duplicate.
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

#### README.md — generated command/component sections

README prose is authored. `/sync-docs` owns only generated blocks marked with HTML comments. For an existing README:
- If a block exists, replace only the content between its `:start` / `:end` markers.
- If a block is missing and the corresponding repo feature exists, insert the block under `## Quickstart` after the install/setup prose and before `## Structure` (or before the next `##` heading if `## Structure` is absent).
- Never rewrite unmarked README prose.

Supported generated blocks:

```md
<!-- sync-docs:install:start -->
<!-- sync-docs:install:end -->

<!-- sync-docs:skills:start -->
<!-- sync-docs:skills:end -->

<!-- sync-docs:extensions:start -->
<!-- sync-docs:extensions:end -->

<!-- sync-docs:slash-commands:start -->
<!-- sync-docs:slash-commands:end -->

<!-- sync-docs:tools:start -->
<!-- sync-docs:tools:end -->

<!-- sync-docs:provider-support:start -->
<!-- sync-docs:provider-support:end -->
```

Generation rules:

1. **Install block** — if `package.json` contains `pi.skills` or `pi.extensions`, prefer `pi install git:<remote>` when a remote URL is available; otherwise include clone + symlink/manual setup for discovered `skills/` and `pi-extensions/`. Keep this block concise because detailed prose can live outside markers.
2. **Skills block** — scan `skills/*/SKILL.md`; read YAML frontmatter `name` and `description`; list each as `- \`/<name>\` — <description>`. If `SPEC.md` has a `## Skills by layer` section, group by those layers (`Composite`, `Workflow`, `Utility`); otherwise group alphabetically under `### Skills`.
3. **Extensions block** — scan `pi-extensions/*/index.ts`; skip directories without `index.ts` such as `_shared/`; read the module doc comment or infer from directory name; list each as `- **<name>** — <description>`.
4. **Slash commands block** — scan extension `index.ts` files for `registerCommand("name", { description: ... })`; list as `- \`/<name>\` — <description>`. Skills are already listed in the skills block; this block is for extension-provided slash commands such as `/ship`, `/release`, and `/wt`.
5. **Tools block** — scan extension `index.ts` files for `registerTool({ name: "...", description: ... })`; list as `- \`<name>()\` — <description>`.
6. **Provider/support block** — infer operational support notes from extension code and docs. For this repo, include GitHub/GitLab support via `gh`/`glab`, note that Bitbucket/unknown providers are detected but not automatically supported for PR/release publishing unless the code says otherwise, and mention any language/ecosystem manifest support documented by `/release`.
7. **Authored prose** — outside generated blocks, keep existing README text.
8. If nothing actionable is found for a generated block, use `TODO: add …` as placeholder inside that block.

#### docs/index.md — full content

Regenerate the entire link list:
- Always link: README.md, AGENTS.md, LICENSE, CHANGELOG.md.
- Conditionally link SPEC.md, REFERENCE.md, CONTRIBUTING.md — only if the file exists.
- Scan `docs/` for any additional `.md` files and append links for each.

### Authored sections (never modified)

Everything not listed above, including but not limited to:
- AGENTS.md: Workflow, Commits, Releases, Merge strategy, Definition of done.
- README.md: project title, description line, Structure, and all unmarked prose. Only `sync-docs:*` generated blocks are modified.
- LICENSE (entire file once populated).
- CONTRIBUTING.md (entire file).

6. Print summary: repo root, files created, files updated (list which sections changed), files skipped (no changes needed).
