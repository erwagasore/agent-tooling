---
name: init-docs
description: Initialise repository docs by creating README.md and AGENTS.md from templates (non-destructive).
---

You are operating inside a software repository workspace.

Goal:
- Ensure README.md and AGENTS.md exist at the repository root.
- Use the templates located at: <skill_dir>/templates/
- Be non-destructive: never overwrite existing human-written content.

Rules:
1) Locate repo root:
   - Prefer: `git rev-parse --show-toplevel`
   - Fallback: current working directory.
2) Determine <project_name>:
   - Prefer repo folder name (basename of repo root).
3) If README.md does not exist:
   - Create it by copying templates/README.md.tmpl
   - Replace placeholders:
     - {{PROJECT_NAME}} -> <project_name>
4) If AGENTS.md does not exist:
   - Create it by copying templates/AGENTS.md.tmpl
   - Replace placeholders:
     - {{PROJECT_NAME}} -> <project_name>
5) If a file already exists:
   - Do not rewrite it.
   - Append a short “Added by /init-docs” block ONLY IF the file is missing the top-level title or is effectively empty.
   - Otherwise, leave it untouched.
6) Always end with a concise summary:
   - repo root
   - files created
   - files skipped
