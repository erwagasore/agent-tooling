# agent-tooling

A collection of pi coding agent extensions and skills — ready-made tooling to supercharge your workflow.

## Quickstart

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

### Skills

**Composite** — end-to-end workflows:
- `/bootstrap-project` — initialise a new project end-to-end — repo, docs, and first working branch
- `/ship-feature` — one command for the entire feature lifecycle: commit, branch, push, PR, and post-merge cleanup

**Workflow** — core git operations:
- `/create-branch` — new branch from up-to-date default branch (supports worktree mode via `/create-branch worktree`)
- `/create-pr` — push and create a squash-merge PR with draft support
- `/create-release` — version, changelog, tag, and release (supports pre-release)
- `/create-skill` — scaffold a new pi skill following the standard architecture
- `/init-repo` — initialise repo, remote, and branch protection
- `/sync-docs` — create or update repo documentation from templates

**Utility** — reusable building blocks:
- `/check-preflight` — validate git repo and remote
- `/check-worktree` — verify the working tree is clean
- `/cleanup-branch` — delete merged local branch (auto-detects branch vs worktree)
- `/commit-changes` — stage and commit with a Conventional Commit message
- `/detect-default-branch` — detect the default branch
- `/detect-existing-pr` — check for an open PR on the current branch
- `/detect-provider` — detect git hosting provider and CLI

### Extensions

- **peculiars** — witty, context-aware status messages while the agent thinks, reads, edits, and runs commands

## Structure

See [AGENTS.md](AGENTS.md#repo-map) for the full repo map.
