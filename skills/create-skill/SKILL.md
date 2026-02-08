---
name: create-skill
description: Scaffold a new pi skill following the standard architecture.
---

Create a new skill directory with a SKILL.md that follows the project's conventions.

## Rules

1. **Gather** from user:
   - **Name**: must be `<verb>-<noun>`. Verbs: `init` (one-time), `create` (repeated), `sync` (reconcile), or propose a new verb with justification.
   - **Purpose**: one-line description.
   - **What it does**: brief explanation to derive the rules from.
2. **Scaffold** `skills/{name}/SKILL.md` using the template below. Populate rules from the user's description using the standard lifecycle phases — omit phases that don't apply:
   - **Preflight** — validate environment, abort early.
   - **Detect** — read context from repo/environment.
   - **Cleanup** — handle stale state.
   - **Gather** — collect or infer inputs.
   - **Confirm** — present plan to user before side effects.
   - **Execute** — perform the action.
   - **Summary** — report what was done.
3. **Conventions** to follow:
   - Rules: numbered, `**bold phase**` — description.
   - Provider agnostic where applicable (GitHub, GitLab, Gitea).
   - Idempotent: skip work already done.
   - User confirmation before external side effects (push, API calls).
   - Concise: optimise for minimal context.
   - No agent instructions in output files.
4. **Templates dir**: create `skills/{name}/templates/` only if the skill needs template files.
5. **Update AGENTS.md**: add the new skill to the repo map.
6. **Summary**: skill name, path, phases used.

## Template

```markdown
---
name: <verb>-<noun>
description: <one-line, no period>
---

<Single sentence stating the goal.>

## Rules

1. **Preflight** — ...
2. ...
N. **Summary**: ...
```
