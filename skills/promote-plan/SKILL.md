---
name: promote-plan
description: Promote completed docs/plan.md into SPEC.md and reset the plan for the next cycle
---

Reconcile a fully-ticked cycle plan into the project's durable SPEC.md, then clear `docs/plan.md` so the next cycle has a clean slate.

## Rules

1. **Preflight** — verify project root (SPEC.md or AGENTS.md present). If neither, abort: "Run from project root."
2. **Plan present** — read `docs/plan.md`. If absent or empty, abort: "No plan to promote."
3. **Plan complete** — count `- [ ]` (unchecked) and `- [x]` (checked) checkboxes. If any unchecked remain, abort with the list of incomplete tasks. Do not promote partial cycles.
4. **Worktree clean** — run `check-worktree` skill. Promotion is a single commit; uncommitted noise has to land first or be stashed.
5. **Diff** — for each completed task, classify the SPEC impact:
   - **Spec change**: the task introduced a contract that belongs in SPEC (new module, option, exit code, convention). Draft the SPEC edit.
   - **No spec change**: housekeeping (gitignore, license, CHANGELOG) or work already specced.
   - **Spec correction**: the task revealed the existing SPEC was wrong — fix it.
6. **Confirm** — present the SPEC diff per task before writing. Ask: any wording to adjust? Any change to defer to a later cycle?
7. **Apply** — write SPEC.md edits, matching the project's existing tone, structure, and section ordering. Update `docs/index.md` if section anchors changed.
8. **Reset plan** — replace `docs/plan.md` with a placeholder: `# Plan` followed by `No active cycle. Run /create-plan to start the next one.`
9. **Suggest commit** — propose `docs(spec): promote <cycle-goal>` as a single Conventional Commit. Do not commit unless the user confirms.
10. **Summary**: tasks promoted, SPEC sections changed, plan reset, commit suggestion.
