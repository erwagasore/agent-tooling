---
name: stress-plan
description: Stress-test an active implementation plan one question at a time for ambiguity, omissions, contradictions, weak task boundaries, dependencies, scope leaks, untestable outcomes, and ungrounded approaches
---

Interrogate an active implementation plan one question at a time, then apply approved plan-only fixes until the cycle is ready to commit.

## Rules

1. **Preflight** — verify the project root contains `AGENTS.md`, a canonical SPEC, or an explicitly supplied plan. If none is present, abort: *"Run from a project root or pass a plan path."*

2. **Detect plan** — if the invocation supplies one path, use it. Otherwise use the active-plan path named by `AGENTS.md`; fall back to `docs/plan.md`, then root `PLAN.md`. The target must exist and contain at least one unchecked task (`- [ ]`). Otherwise abort: *"No active plan found. Run `/create-plan` first."*

3. **Load context** — read the plan fully, then read `AGENTS.md` and the canonical SPEC fully when present. Follow documents they explicitly identify as normative, preserving declared document precedence. Read companion documents only when a plan task changes or references them. The plan is the only editable target; normative and companion documents are read-only context for this workflow.

4. **Confirm scope** — report the detected plan and normative context with their roles. Proceed directly when discovery is unambiguous. Ask the user to choose only when multiple active plans or competing normative documents are found.

5. **Check edit safety** — inspection is allowed on any branch. Before the first edit, inspect repository state. If repository rules prohibit changes on the default branch, refuse to edit there. Warn about unrelated working-tree changes while allowing an already-modified plan. Never commit, push, create a PR, or edit any file except the target plan.

6. **Build the model** — identify the cycle goal, tasks, acceptance criteria, dependencies, external blockers, scope boundary, and intended durable contract changes. Distinguish current normative policy from an explicitly planned future policy change.

7. **Challenge** — ask one question at a time about a specific, material problem in one of these categories:

   | Category | Problem |
   |---|---|
   | **Ambiguous** | A goal, task, dependency, or acceptance criterion permits materially different behavior, architecture, scope, or verification. |
   | **Missing** | A decision, task, dependency, migration, test, or documentation update required by the cycle goal or definition of done is absent. |
   | **Contradictory** | Plan statements conflict with each other, or planned implementation conflicts with normative policy without a preceding contract task that intentionally changes it. |
   | **Untestable** | Completion cannot be verified by an automated check, named inspection, or concrete observable outcome. |
   | **Non-atomic** | A task cannot be implemented, verified, and merged independently, or combines unrelated changes that warrant separate Conventional Commits. |
   | **Dependency** | Ordering is missing, incorrect, cyclic, or assumes unavailable project/upstream work. |
   | **Scope** | Work is unrelated to the cycle goal, or an exclusion removes work required to achieve it. |
   | **Ungrounded** | A non-trivial approach lacks a relevant principle, invariant, standard, known algorithm, established pattern, documented library guarantee, or project precedent explaining why it should work. |

   A task may span multiple files when they form one coherent contract or behavior change. An intentional SPEC change is valid when an explicit contract task precedes dependent implementation.

8. **Ground approaches proportionally** — challenge grounding when correctness, ownership, concurrency, security, consistency, or performance depends on the approach. Do not demand citations for straightforward wiring or markup, force inconsequential implementation choices, accept pattern name-dropping without relevance, or treat “best practice” as evidence. Ask both:
   - What principle, invariant, standard, algorithm, pattern, guarantee, or precedent grounds this approach?
   - How will implementation or verification preserve the relevant invariant?

   Self-contained reasoning is sufficient for an invariant or algorithm. Claims based on standards, library guarantees, security guidance, or published approaches must name an authoritative source; verify it when research tools are available. Never fabricate theorem names, citations, or best-practice claims.

9. **Keep question discipline** — each message asks exactly one question, names the category and plan section, and explains the concrete execution risk. Prioritize blockers and high-impact gaps. Do not ask what the plan or normative context already answers, invent theoretical edge cases, or ask preference-only questions. Allow explicit deferral as out of scope.

10. **Apply answers** — after each answer, explain whether it resolves the gap and propose an exact plan edit (old → new, or an insertion with location). Wait for approval before editing. If durable policy is established, add it to the plan's contract task rather than editing the SPEC. If no edit is needed, say so. Record deferred issues for the summary; add them to the plan's out-of-scope section only when needed to prevent future confusion. After an approved edit, continue with the next material gap.

11. **Stop** — finish as soon as the plan has a concrete goal, independently committable Conventional Commit tasks, contract changes ordered before dependent implementation, objective completion criteria, correct dependencies/blockers, required tests/docs, a clear scope boundary, proportionately grounded non-trivial approaches, and no unresolved high-impact gaps. Do not impose a question quota.

12. **Summary** — report:
   - questions asked and plan edits made,
   - a table of changes by plan section and challenge category,
   - deferred or out-of-scope considerations,
   - remaining blockers,
   - verdict: **Ready to commit** or **Not ready — unresolved blockers**.
