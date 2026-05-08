# agent-tooling

A collection of pi coding agent extensions and skills — ready-made tooling to supercharge your workflow.

## Quickstart

<!-- sync-docs:install:start -->
```bash
pi install git:github.com/erwagasore/agent-tooling
```

That's it. All skills and extensions are available immediately.

<details>
<summary>Manual setup (pi)</summary>

1. Clone the repo:
   ```bash
   git clone git@github.com:erwagasore/agent-tooling.git
   ```
2. Symlink skills into pi:
   ```bash
   ln -s "$(pwd)/agent-tooling/skills" ~/.pi/agent/skills
   ```
3. Symlink extensions into pi:
   ```bash
   ln -s "$(pwd)/agent-tooling/pi-extensions" ~/.pi/agent/extensions
   ```
4. Reload your pi session.

</details>

<details>
<summary>Claude Code</summary>

Clone the repo and add the skills directory to your settings:

```bash
git clone git@github.com:erwagasore/agent-tooling.git
```

In your project's `.claude/settings.json` (or global `~/.claude/settings.json`):

```json
{
  "skills": ["/path/to/agent-tooling/skills"]
}
```

Skills follow the [Agent Skills standard](https://agentskills.io) and work as slash commands.

</details>

<details>
<summary>OpenAI Codex</summary>

Clone the repo and add the skills directory to your settings:

```bash
git clone git@github.com:erwagasore/agent-tooling.git
```

In your project's `.codex/settings.json` (or global `~/.codex/settings.json`):

```json
{
  "skills": ["/path/to/agent-tooling/skills"]
}
```

</details>

<details>
<summary>Other agents</summary>

These skills are plain Markdown files following the [Agent Skills standard](https://agentskills.io). Any agent that supports the standard can load them. For agents without native skill support, you can copy the contents of any `SKILL.md` into your system prompt or context files (e.g. `AGENTS.md`, `CLAUDE.md`).

</details>
<!-- sync-docs:install:end -->

<!-- sync-docs:skills:start -->
### Skills

**Composite** — end-to-end workflows:
- `/bootstrap-project` — initialise a new project end-to-end — repo, docs, and first working branch
- `/ship-feature` — push current branch, create a PR, and after merge clean up and land back on the default branch (human-facing doc for `/ship`)

**Workflow** — core operations:
- `/commit-changes` — stage and commit with a Conventional Commit message
- `/create-branch` — new branch from up-to-date default branch
- `/create-plan` — capture the current cycle's planned work in `docs/plan.md`
- `/create-pr` — push branch and create a squash-merge PR
- `/create-release` — version, changelog, tag and push a release locally (human-facing doc for `/release`)
- `/create-skill` — scaffold a new pi skill following the standard architecture
- `/init-repo` — initialise repo, create remote, configure branch protection
- `/promote-plan` — promote completed `docs/plan.md` into SPEC.md and reset for the next cycle
- `/stress-test-spec` — stress-test project spec files by asking one question at a time to find gaps, ambiguities, contradictions, and untestable rules
- `/sync-docs` — create or update core repo docs and generated README command sections

**Utility** — reusable building blocks:
- `/check-preflight` — validate git repo and remote before proceeding
- `/check-worktree` — verify the git working tree is clean
- `/cleanup-branch` — delete local branch if merged and remote is gone
- `/detect-default-branch` — detect the default branch of the current repo
- `/detect-existing-pr` — report the latest PR for the current branch in any state (`open`, `merged`, or `closed`)
- `/detect-provider` — detect git hosting provider and CLI from remote URL
<!-- sync-docs:skills:end -->

<!-- sync-docs:extensions:start -->
### Extensions

- **git-context** — one-call git repository introspection
- **git-guard** — declarative repo-state assertions
- **git-pr** — provider-aware PR creation via `gh` / `glab`
- **git-release** — version, changelog, tag, push, and provider release via `/release`
- **git-ship** — state-machine `/ship` command for the feature lifecycle
- **git-worktree** — linked worktree management via `/wt new`, `/wt land`, and `/wt list`
- **peculiars** — witty, context-aware status messages while the agent thinks, reads, edits, and runs commands
- **plan-cycle** — model-aware `/plan` command wrapping the create-plan skill
<!-- sync-docs:extensions:end -->

<!-- sync-docs:slash-commands:start -->
### Extension slash commands

- `/plan` — draft `docs/plan.md` via the create-plan skill with model-aware prompting
- `/release status` — preview bump type, next version, and draft changelog without mutation
- `/release` — apply the computed release: bump manifests, changelog, commit, tag, push, and publish provider release notes
- `/release patch|minor|major` — apply a release with an explicit bump override
- `/ship` — detect feature-delivery state and run the right phase: push + PR, wait, or land
- `/ship status` — print ship state and predicted action without mutating anything
- `/wt new <branch>` — create a linked worktree on a new branch from the default branch
- `/wt land` — remove the current linked worktree safely and print a `cd` hint back to the main repo
- `/wt list` — list all git worktrees in a friendly table
<!-- sync-docs:slash-commands:end -->

<!-- sync-docs:tools:start -->
### Extension tools

- `git_context()` — return provider, branches, worktree mode, cleanliness, remote presence, latest PR, and soft warnings in one call
- `git_guard()` — assert repo preconditions such as clean worktree, remote presence, branch mode, and worktree mode
- `git_pr()` — create or re-use a GitHub/GitLab pull/merge request for the current branch
<!-- sync-docs:tools:end -->

<!-- sync-docs:provider-support:start -->
### Provider and ecosystem support

- **PRs:** GitHub via `gh`; GitLab via `glab`; existing PR detection covers open, merged, and closed states.
- **Releases:** GitHub via `gh release create`; GitLab via `glab release create`; Bitbucket/unknown providers are detected but do not publish PRs or release notes automatically.
- **Manifest versions:** `/release` detects the project root, infers ecosystem signals from root marker files, applies high-confidence built-ins (`package.json`, `Cargo.toml`, `pyproject.toml`, `build.zig.zon`), and uses a safe generic fallback for root-level manifest-like files with exactly one unambiguous semver-like version field.
- **Verification:** local contributors can run `npm run verify` to typecheck and run the Vitest suite.
<!-- sync-docs:provider-support:end -->

## Structure

See [AGENTS.md](AGENTS.md#repo-map) for the full repo map.
