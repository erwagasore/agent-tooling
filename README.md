# agent-tooling

A collection of pi coding agent extensions and skills — ready-made tooling to supercharge your workflow.

## Quickstart

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

### Skills

- `/init-repo` — initialise repo, remote, and branch protection
- `/sync-docs` — bootstrap or update repo documentation
- `/create-branch` — new branch from up-to-date default
- `/create-pr` — push and create a squash-merge PR
- `/create-release` — version, changelog, tag, and release
- `/create-skill` — scaffold a new pi skill

### Extensions

- **peculiars** — witty, context-aware status messages while the agent thinks, reads, edits, and runs commands

## Structure

See [AGENTS.md](AGENTS.md#repo-map) for the full repo map.
