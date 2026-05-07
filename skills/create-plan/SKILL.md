---
name: create-plan
description: Draft docs/plan.md as a checklist of independently-committable tasks for the current cycle
---

Capture the current cycle's planned work as a single transient checklist that lives in `docs/plan.md` until promoted into SPEC.md.

## Rules

1. **Preflight** — verify project root (SPEC.md or AGENTS.md present). If neither, abort: "Run from project root."
2. **Single-plan invariant** — read `docs/plan.md`. If any unchecked task (`- [ ]`) exists, abort: "An active plan already exists. Run `/promote-plan` first." Empty or absent is fine.
3. **Detect spec** — locate the project's SPEC file (`SPEC.md` at root, or the project's named equivalent). Skim it — plan tasks reference its sections.
4. **Gather** — distil from the current conversation:
   - One-sentence cycle goal (what milestone or change does this cycle deliver?).
   - Discrete tasks; each must be independently committable, testable on its own, titled as a Conventional Commit (`<type>(<scope>): <imperative>`), and anchored to a SPEC section (file path + line number where possible).
5. **Confirm** — present the draft list to the user before writing. Ask: tasks to add, remove, reorder, or merge? Dependencies between tasks correct? Cycle size sensible (3–8 tasks is the sweet spot)?
6. **Write** `docs/plan.md`:
   - Title and one-sentence cycle goal.
   - 3-line "How to use" block: pick next task, branch, tick when merged.
   - Phased checklist. Each item: bold Conventional-Commit title; one paragraph with file paths and SPEC refs; a *Done when* acceptance line.
   - "Ordering and parallelism" block at the bottom listing inter-task dependencies.
7. **Summary**: cycle goal, task count, path to `docs/plan.md`, what to run next.
