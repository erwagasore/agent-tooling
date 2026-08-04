---
name: review-codebase
description: Run a closed multi-pass code-quality audit (memory, API ergonomics, language idioms, elegance)
---

Produce definitive, non-dripping code-quality reviews. Each pass is a **closed audit**: one full list, severity-tagged, then stop. Passes run in fixed order. Do not invent findings to fill space; empty material sets are a valid and preferred outcome after prior fixes.

## Review target (git-scoped)

Every invocation binds to **git state** first. Choose exactly one target mode:

| Mode | When to use | What to read |
|---|---|---|
| **`diff`** | Default when the worktree or branch has changes worth reviewing (feature branch, PR, dirty tree) | Only files/hunks in scope (see resolution below), plus minimal context call sites they touch |
| **`full`** | Clean tree on default branch, release audit, or user says "entire codebase" / "full tree" | Whole project sources (respect layout: `src/`, manifests, specs) |

### Mode resolution

1. Inspect git (run from repo root):
   - `git rev-parse --show-toplevel` / current branch / `HEAD` short sha  
   - Default branch (e.g. `main` / `master`)  
   - Dirty? `git status --porcelain`  
   - Ahead of default? `git log --oneline @{upstream}..HEAD` or `default..HEAD`  
   - Diff stat: `git diff --stat` (worktree) and `git diff --stat default...HEAD` (branch)
2. **Pick mode:**
   - User said `diff` / `changes` / `PR` / `this branch` → **`diff`**
   - User said `full` / `entire` / `whole codebase` → **`full`**
   - Unspecified:
     - Dirty worktree **or** branch ≠ default with commits/diff vs default → **`diff`**
     - Clean and on default branch → **`full`**
3. **`diff` file set** (union, existing files only):
   - Unstaged: `git diff --name-only`
   - Staged: `git diff --cached --name-only`
   - Branch: `git diff --name-only default...HEAD`
   - Untracked relevant sources: `git ls-files --others --exclude-standard` (include if they are code/specs; skip build junk)
4. **Read the actual diffs**, not only file lists: `git diff`, `git diff --cached`, `git diff default...HEAD`. Judge **introduced or changed** behavior. Mention pre-existing issues only if the diff touches them or makes them worse — label those **pre-existing**.
5. **`full` baseline:** prefer clean `HEAD`. If dirty during `full`, state that explicitly and include dirty paths or ask to stash; do not silently mix.
6. Header must state mode + baseline:

```text
**Target:** diff | full
**Baseline:** <default>…HEAD (<sha>) | worktree + HEAD | HEAD <sha> clean
**Paths:** <N files>  (diff: list or stat summary; full: tree roots)
```

## Passes (fixed order)

| # | Pass | When |
|---|---|---|
| 1 | **Memory management** | Only for languages with manual or explicit ownership (Zig, Rust, C, C++). **Skip** for GC/ARC-default stacks (Go, Java, Python, TS/JS, etc.) unless the user forces it. |
| 2 | **API ergonomics** | Always (public + internal call-site surfaces in target). |
| 3 | **Language / ecosystem idioms** | Always — name the language from the repo. |
| 4 | **Overall elegance and simplicity** | Always — clarity and simplicity **of the target**. |

Default invocation runs **one pass at a time** (finish pass N before N+1). If the user names a pass, run only that pass. In **`diff` mode**, every pass still uses the same four lenses but **only on the target file set** (plus unavoidable callees/callers for understanding).

## Severity (every finding)

| Severity | Meaning | Action posture |
|---|---|---|
| **Must fix** | Correctness bug, leak/UAF, broken API contract, unsafe idiom | Fix before merge |
| **Should improve** | Real friction or real risk under normal use | Fix in this cycle if touching the area |
| **Optional later** | Taste / polish / scale-only | No obligation |
| **Accept as designed** | Deliberate tradeoff or dependency limit | Not a defect — document, do not re-open |

## Output format (mandatory per pass)

Use this structure exactly. Keep it scannable. No essay before the verdict table.

```markdown
# <Pass title> audit — **CLOSED**

**Target:** diff | full
**Baseline:** <git description>
**Scope:** <paths / stacks> @ <sha or dirty>
**Focus:** <one line>
**Not in scope:** <exclusions; other passes; unchanged code in diff mode>

## Result

| Class | Count |
|---|---|
| **Must fix** | N |
| **Should improve** | N |
| **Optional later** | N |
| **Accept as designed** | noted |

**Verdict:** <one or two sentences>.

## What's solid
| Surface | Why |
|---|---|
| … | … |

## Must fix
### 1. <title>
**Where:** `path` / symbol
**Problem:** …
**Remedy:** …

## Should improve
### 1. …
(same shape)

## Optional later
| ID | Item | When it would matter |
|---|---|---|
| O1 | … | … |

## Accept as designed
- …

## Priority if you act
1. …
2. …

## Close
**`<Pass>` audit: CLOSED.**
- No hidden follow-up list.
- Do not re-run this pass on unchanged code (same HEAD + same target).
```

If a severity class is empty, keep the section and write **None.**

## Rules

1. **Detect git + project** — mode/baseline/paths first (see Review target). Then language(s), layout, entrypoints (`src/`, manifests, `SPEC.md` / `AGENTS.md` if present). Note whether Pass 1 applies.

2. **Confirm scope** — state **target mode**, **pass number**, and exclusions. If the user asked for "review" without a pass number, start at Pass 1 (or 2 if memory is skipped) and say so.

3. **Read before judging** —  
   - **`diff`:** read diffs + full file context for touched symbols; follow imports only as needed.  
   - **`full`:** read real ownership/API boundaries; do not review from memory of an older tree.  
   Always pin **Scope** to sha or dirty.

4. **One closed list** — every material issue for **this pass** × **this target** appears in this response. Optional later is complete too.

5. **No drip** — re-run of the **same** pass + **same target** is **verification only** against the prior list (fixed / still open / deferred). Do not mine new optional items unless the diff changed. If clean: *"Pass N verification: CLOSED — prior findings addressed; no material new issues."*

6. **No performance theater** — do not manufacture findings. **Zero must-fix is success.**

7. **Diff-mode honesty**
   - Findings must cite touched paths/hunks unless labeled **pre-existing**.  
   - Do not demand a full-tree refactor from a one-file PR unless the diff makes it necessary.  
   - If the diff is docs/chore only, say so quickly; empty Must/Should is fine.

8. **Pass-specific lenses**

   **Pass 1 — Memory (manual ownership only)**  
   - Ownership: who allocates, who frees, cross-boundary borrows  
   - Lifetimes: UAF, dangling references, iterator invalidation  
   - Leaks / double-free / arena vs GPA misuse  
   - Bounds: unbounded reads, retention growth, connection/request caps  
   - Error-path cleanup (`errdefer`, RAII, `Drop`)  
   - Steady-state RSS vs build-time peak (label which)  
   - Not: micro-optimizations without ownership bugs  

   **Pass 2 — API ergonomics**  
   - Consistency of names, getters vs fields, error sets  
   - Composition: small inputs, explicit ownership transfer  
   - Call-site repetition vs missing shared context types  
   - Public surface width (library facade vs internals)  
   - Parse/result-as-data vs ad hoc side effects  
   - Not: implementation style unrelated to callers  

   **Pass 3 — Language & ecosystem idioms**  
   - Prefer std/ecosystem patterns over novel ones without cause  
   - Error handling idioms, iterators, formatting, build integration  
   - Naming and module layout conventions for that language  
   - Clippy/zig zen/go proverb class issues that affect clarity  
   - Not: rewrite to another language's taste  

   **Pass 4 — Elegance & simplicity**  
   - Essential vs accidental complexity  
   - Duplication that should be one abstraction (or one removal)  
   - Layers that don't pay rent  
   - Feature-shaped APIs with no consumer  
   - "Would a strong maintainer delete this?"  
   - Not: re-litigate Pass 1–3 items; reference them only if still open  

9. **Cross-pass discipline**  
   - Do not smuggle Pass 4 taste into Pass 1.  
   - Do not restate a fixed Pass 1 item as a new Pass 2 finding.  
   - If an issue spans passes, file it once under the **earliest** pass and reference it later.

10. **After the pass** — ask whether to (a) implement Must/Should, (b) proceed to the next pass, or (c) stop. Do not start the next pass in the same turn unless the user asked for all passes or "continue".

11. **Implement mode** — when asked to fix findings: only Must + user-selected Should. Leave Optional later alone unless requested. Re-verify the pass when done.

12. **Summary** (end of a full 1→4 sequence only):
    - Target mode + baseline sha
    - Table: pass → must → should → optional → status (closed/skipped)
    - What was fixed vs deferred
    - Explicit: *"Full review sequence complete. No further passes."*
