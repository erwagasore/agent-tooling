---
name: stress-test-spec
description: Stress-test project spec files by asking one question at a time to find gaps, ambiguities, contradictions, and untestable rules
---

Interrogate a project's specification documents one question at a time, surfacing real problems and applying fixes after each answer.

## Rules

1. **Detect** — find spec files in the project. Scan the repo root and `.pi/` for files that define project rules, constraints, or conventions. Typical names:
   - `SPEC.md`
   - `REFERENCE.md`
   - `AGENTS.md`, `.pi/AGENTS.md`


   If no spec files are found, abort: *"No spec files found. Create a SPEC.md first."*

   If spec files point to other files (e.g., "see REFERENCE.md"), follow and include those too.

2. **Read** — read every detected spec file fully. Build a mental model of:
   - What rules exist
   - What domains they cover
   - How files reference each other
   - What's prescriptive (hard rules) vs descriptive (context)

3. **Confirm** — list the files found and their roles. Ask the user: *"These are the spec files I found. Should I include or exclude any?"* Proceed after confirmation.

4. **Interrogate** — ask **one question at a time**. Each question must identify a specific, real problem in one of four categories:

   | Category | What it means | Example |
   |---|---|---|
   | **Ambiguous** | Could be interpreted two ways | "Your spec says 'short description' — does that mean one sentence or one paragraph?" |
   | **Missing** | A situation that could arise with no rule to handle it | "What happens when a note fits two categories?" |
   | **Contradictory** | Two rules that conflict | "Rule A says X, but Rule B says not-X. Which wins?" |
   | **Untestable** | A rule too vague to verify compliance | "How do you measure 'concise enough'?" |

   **Discipline:**
   - One question per message. Wait for the answer before asking the next.
   - Only ask about things that would **actually cause confusion** during execution. Don't invent theoretical edge cases that will never arise.
   - State which file and which section the problem is in.
   - Explain *why* it's a problem — show the two interpretations, the missing scenario, the conflicting rules, or the vague criterion.
   - After exhausting real gaps, stop. Say: *"No more gaps found. Here's a summary of all changes made."*

5. **Apply** — after each answer, suggest a **specific edit** to the relevant file:
   - Show what to change (old text → new text) or what to add and where.
   - Wait for the user to approve before making the edit.
   - If the answer reveals the spec is already correct and no change is needed, say so and move to the next question.
   - If the answer requires changes across multiple files, list all edits together.

6. **Summary** — when no more real gaps remain, output:
   - Number of questions asked
   - Table of changes made: file, section, what changed, which category it fixed
   - Any items the user deferred ("out of scope for now") listed as future considerations
