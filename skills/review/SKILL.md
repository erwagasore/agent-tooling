---
name: review
description: Closed multi-pass code review — memory, API, idioms, elegance; git-scoped diff or full
---

Produce definitive, non-dripping code-quality reviews. Each pass is a **closed audit**: one full list, severity-tagged, then stop. Do not invent findings to fill space; empty material sets are success after prior fixes.

## Invocation

Pi registers this skill as **`/skill:review`**. Arguments after the command are freeform tokens (order-independent).

```text
/skill:review                         # auto pass + auto target
/skill:review memory                  # pass 1, auto target
/skill:review api diff                # pass 2, branch/worktree changes
/skill:review idioms full             # pass 3, entire tree
/skill:review elegance                # pass 4, auto target
/skill:review simplicity full         # pass 4 alias + full
/skill:review diff                    # auto pass, force diff
/skill:review full memory             # pass 1, force full
```

Natural language that loads this skill uses the same tokens (`memory`, `api diff`, …).

### Pass tokens (pick at most one)

| Token(s) | Pass |
|---|---|
| `memory`, `mem` | 1 — Memory management |
| `api`, `ergonomics` | 2 — API ergonomics |
| `idioms`, `idiom`, `style` | 3 — Language / ecosystem idioms |
| `elegance`, `simplicity`, `elegant`, `simple` | 4 — Elegance & simplicity |
| `all` | Run passes 1→4 in order (still one pass per turn unless user said continue/all-at-once) |

If **no pass token**: run the next incomplete pass in this conversation, or pass 1 (skip to 2 when memory does not apply).

### Target tokens (pick at most one)

| Token | Mode |
|---|---|
| `diff`, `changes`, `pr`, `branch` | Review git changes only |
| `full`, `entire`, `whole`, `tree` | Review entire codebase at HEAD |

### Default target (`diff` vs `full`)

When **no target token** is given, choose automatically:

| Git state | Default |
|---|---|
| Dirty worktree | **`diff`** |
| Not on default branch, and `default...HEAD` is non-empty | **`diff`** |
| Clean worktree **and** on default branch | **`full`** |
| Clean worktree, not default, but **no** diff vs default | **`full`** (nothing to diff) |

**Rationale:** day-to-day work is branch/PR review → `diff`. A clean `main` checkout is a whole-tree audit → `full`. Always **state the chosen default** in the audit header. User tokens **always override**.

If `diff` is selected (explicit or default) but the file set is empty, say so and stop — do not silently upgrade to `full` unless the user asks.

## Review target (git-scoped)

Every invocation binds to **git state** first.

| Mode | What to read |
|---|---|
| **`diff`** | Only files/hunks in scope + minimal call-site context |
| **`full`** | Whole project sources (`src/`, manifests, specs as relevant) |

### Diff file set (union, existing paths only)

- Unstaged: `git diff --name-only`
- Staged: `git diff --cached --name-only`
- Branch: `git diff --name-only <default>...HEAD`
- Untracked sources: `git ls-files --others --exclude-standard` (code/specs only; skip build junk)

Read the actual diffs (`git diff`, `--cached`, `<default>...HEAD`). Judge **introduced or changed** behavior. Pre-existing issues only if the diff touches them or makes them worse — label **pre-existing**.

**`full`:** prefer clean `HEAD`. If dirty during `full`, say so and include dirty paths or ask to stash.

Header must include:

```text
**Target:** diff | full
**Baseline:** <default>…HEAD (<sha>) | worktree + HEAD | HEAD <sha> clean
**Paths:** <N files> …
```

## Passes (fixed order)

| # | Pass | When |
|---|---|---|
| 1 | **Memory management** | Manual/explicit ownership languages only (Zig, Rust, C, C++). **Skip** GC-default stacks unless user forces `memory`. |
| 2 | **API ergonomics** | Always (surfaces in target). |
| 3 | **Language / ecosystem idioms** | Always — name the language. |
| 4 | **Elegance & simplicity** | Always — of the target only. |

One pass per turn unless the user asked for `all` or "continue". In **`diff` mode**, apply the lens only to the target file set (+ necessary callees).

## Severity (every finding)

| Severity | Meaning | Action posture |
|---|---|---|
| **Must fix** | Correctness bug, leak/UAF, broken API contract, unsafe idiom | Fix before merge |
| **Should improve** | Real friction or risk under normal use | Fix this cycle if touching the area |
| **Optional later** | Taste / polish / scale-only | No obligation |
| **Accept as designed** | Deliberate tradeoff or dependency limit | Not a defect |

## Output format (mandatory per pass)

Scannable; no essay before the verdict table.

```markdown
# <Pass title> audit — **CLOSED**

**Target:** diff | full
**Baseline:** <git description>
**Scope:** <paths / stacks> @ <sha or dirty>
**Focus:** <one line>
**Not in scope:** <exclusions>

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

Empty severity class → write **None.**

## Rules

1. **Parse args** — extract pass token + target token (see Invocation). Remainder ignored unless clearly a path limiter.

2. **Detect git + project** — resolve target mode (token or default table), baseline, paths. Then language(s), layout, entrypoints. Note whether Pass 1 applies.

3. **Confirm scope** — state **command** (e.g. `/skill:review api diff`), **target** (and whether defaulted), **pass**, exclusions.

4. **Read before judging** — `diff`: diffs + context for touched symbols. `full`: real boundaries at HEAD. Pin Scope to sha or dirty.

5. **One closed list** — all material issues for this pass × target in this response.

6. **No drip** — same pass + same target re-run = verification only against the prior list. No new optional mining unless the diff changed.

7. **No performance theater** — zero must-fix is success.

8. **Diff-mode honesty** — cite touched paths; no full-tree refactors from tiny PRs unless necessary; docs-only diffs may have empty Must/Should.

9. **Pass-specific lenses**

   **Pass 1 — Memory** — ownership, lifetimes, leaks/double-free, bounds, error-path cleanup, steady-state vs peak RSS. Not micro-opts without bugs.

   **Pass 2 — API** — naming consistency, composition, error sets, surface width, parse-as-data. Not unrelated implementation style.

   **Pass 3 — Idioms** — std/ecosystem patterns, error/iterator/format/build conventions for **this** language. Not another language’s taste.

   **Pass 4 — Elegance** — essential vs accidental complexity, duplication, rent-free layers, APIs with no consumer. Do not re-litigate open Pass 1–3 items; reference only.

10. **Cross-pass** — file once under the earliest pass; no smuggling taste into memory.

11. **After the pass** — offer (a) fix Must/Should, (b) next pass, (c) stop. Don’t auto-start the next pass unless `all` / continue.

12. **Implement mode** — Must + user-selected Should only. Re-verify when done.

13. **Full sequence summary** (after 1→4 only): target + sha; pass counts; fixed vs deferred; *"Full review sequence complete."*
