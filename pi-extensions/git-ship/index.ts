/**
 * git-ship — state-machine slash command for the feature lifecycle.
 *
 * Detects which ship phase applies to the current branch and runs it without
 * LLM round-trips for the mechanical steps (push, cleanup, fetch, pull).
 * Judgement bits stay user-driven via ctx.ui (confirm before push, prompt
 * for PR title; PR body auto-derives from the commit log).
 *
 * Replaces the prose state machine inside the `ship-feature` skill. PR
 * detection and creation are delegated to the shared `_shared/git-internals`
 * helpers (consumed by `git-pr` for the tool surface).
 *
 * See SPEC.md § Extensions / git-ship.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import {
	createPr,
	detectDefaultBranch,
	detectMode,
	detectProvider,
	type ExecRunner,
	type ExistingPr,
	findExistingPr,
	type GitMode,
	type Provider,
	removeWorktree,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Types ────────────────────────────────────────────────────

type ShipState =
	| "default-clean"
	| "default-dirty"
	| "no-pr"
	| "pr-open"
	| "pr-merged"
	| "pr-closed";

interface ShipContext {
	provider: Provider;
	defaultBranch: string;
	currentBranch: string;
	mode: GitMode;
	isClean: boolean;
	hasRemote: boolean;
	existingPr: ExistingPr | null;
}

// ── State detection ──────────────────────────────────────────

async function readShipContext(exec: ExecRunner, signal?: AbortSignal): Promise<ShipContext> {
	const remoteUrl = await tryExec(exec, "git", ["remote", "get-url", "origin"], signal);
	const status = await tryExec(exec, "git", ["status", "--porcelain"], signal);
	const currentBranch =
		(await tryExec(exec, "git", ["branch", "--show-current"], signal)) ?? "";
	const defaultBranch = await detectDefaultBranch(exec, signal);
	const mode = await detectMode(exec, signal);
	const provider = detectProvider(remoteUrl);
	const hasRemote = remoteUrl !== null;

	let existingPr: ExistingPr | null = null;
	if (hasRemote && currentBranch) {
		existingPr = await findExistingPr(exec, provider, currentBranch, signal);
	}

	return {
		provider,
		defaultBranch,
		currentBranch,
		mode,
		isClean: status === "",
		hasRemote,
		existingPr,
	};
}

export function detectShipState(c: ShipContext): ShipState {
	if (c.currentBranch === c.defaultBranch) {
		return c.isClean ? "default-clean" : "default-dirty";
	}
	if (!c.existingPr) return "no-pr";
	return `pr-${c.existingPr.state}` as ShipState;
}

// ── Status print ─────────────────────────────────────────────

function describeState(state: ShipState, c: ShipContext): string {
	const lines = [
		`State:           ${state}`,
		`Provider:        ${c.provider}`,
		`Default branch:  ${c.defaultBranch}`,
		`Current branch:  ${c.currentBranch || "(detached)"}`,
		`Mode:            ${c.mode}`,
		`Worktree clean:  ${c.isClean}`,
		`Existing PR:     ${
			c.existingPr ? `#${c.existingPr.number} (${c.existingPr.state}) ${c.existingPr.url}` : "none"
		}`,
		"",
	];
	switch (state) {
		case "default-clean":
			lines.push("→ Nothing to ship. Run `/create-branch` to start work.");
			break;
		case "default-dirty":
			lines.push("→ Dirty work on default branch. Run `/create-branch` then `/commit-changes`.");
			break;
		case "no-pr":
			lines.push("→ Will push branch and open a PR.");
			break;
		case "pr-open":
			lines.push("→ PR is open. Wait for merge, then run `/ship` again.");
			break;
		case "pr-merged":
			lines.push("→ Will clean up the local branch and land on the default branch.");
			break;
		case "pr-closed":
			lines.push("→ PR was closed without merging. Investigate before re-shipping.");
			break;
	}
	return lines.join("\n");
}

// ── Phase implementations ────────────────────────────────────

async function execLoud(
	exec: ExecRunner,
	cmd: string,
	args: string[],
	signal?: AbortSignal,
): Promise<{ ok: boolean; out: string }> {
	try {
		const r = await exec(cmd, args, { signal });
		const out = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
		return { ok: r.code === 0 && !r.killed, out };
	} catch (err) {
		return { ok: false, out: String((err as Error).message ?? err) };
	}
}

async function phaseNoPr(
	exec: ExecRunner,
	c: ShipContext,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	if (c.provider === "unknown") {
		ctx.ui.notify(
			"Provider unknown — cannot create a PR automatically. Push manually and use the host's web UI.",
			"warning",
		);
		return;
	}
	if (!c.isClean) {
		ctx.ui.notify(
			"Worktree has uncommitted changes. Commit or stash before shipping.",
			"warning",
		);
		return;
	}

	const diffStat = await tryExec(
		exec,
		"git",
		["diff", "--stat", `${c.defaultBranch}..HEAD`],
		signal,
	);
	const commitList = await tryExec(
		exec,
		"git",
		["log", "--reverse", "--pretty=format:%h %s", `${c.defaultBranch}..HEAD`],
		signal,
	);
	if (!commitList) {
		ctx.ui.notify(
			`No commits on \`${c.currentBranch}\` ahead of \`${c.defaultBranch}\`. Nothing to ship.`,
			"warning",
		);
		return;
	}

	const lastSubject = commitList.trim().split("\n").pop()?.replace(/^[0-9a-f]+\s+/, "") ?? "";

	console.log(`\n=== Ready to push \`${c.currentBranch}\` ===`);
	if (diffStat) console.log(diffStat);
	console.log(`\nCommits:\n${commitList}\n`);

	const okPush = await ctx.ui.confirm(
		"Push branch?",
		`Push \`${c.currentBranch}\` to origin and continue with PR creation?`,
	);
	if (!okPush) {
		ctx.ui.notify("Push cancelled.", "info");
		return;
	}

	const push = await execLoud(exec, "git", ["push", "-u", "origin", c.currentBranch], signal);
	if (!push.ok) {
		ctx.ui.notify(`git push failed:\n${push.out}`, "error");
		return;
	}
	console.log(push.out);

	const title =
		(await ctx.ui.input("PR title (Conventional Commit):", lastSubject)) ?? lastSubject;
	if (!title.trim()) {
		ctx.ui.notify("Empty PR title; aborting before PR creation.", "warning");
		return;
	}

	const body = `## Commits\n\n${commitList
		.split("\n")
		.map((line) => `- ${line}`)
		.join("\n")}\n`;

	const created = await createPr(
		exec,
		c.provider,
		{ title, body, base: c.defaultBranch, head: c.currentBranch },
		signal,
	);
	if (!created.ok) {
		ctx.ui.notify(`PR creation failed:\n${created.error}`, "error");
		return;
	}
	console.log(`Opened PR #${created.number}: ${created.url}`);
	ctx.ui.notify(`PR #${created.number} opened — ${created.url}`, "info");
	ctx.ui.notify("Run `/ship` again after merge to land.", "info");
}

async function phasePrOpen(c: ShipContext, ctx: ExtensionCommandContext): Promise<void> {
	const pr = c.existingPr!;
	const msg = `PR #${pr.number} is open: ${pr.url}\nMerge it on the host, then run \`/ship\` again to land.`;
	console.log(msg);
	ctx.ui.notify(`PR #${pr.number} open — ${pr.url}`, "info");
}

async function phasePrMerged(
	exec: ExecRunner,
	c: ShipContext,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	const remoteHead = await tryExec(
		exec,
		"git",
		["ls-remote", "--heads", "origin", c.currentBranch],
		signal,
	);
	if (remoteHead) {
		const ok = await ctx.ui.confirm(
			"Remote branch still exists",
			`The remote branch \`${c.currentBranch}\` is still present. Delete the local branch anyway?`,
		);
		if (!ok) {
			ctx.ui.notify("Cleanup skipped — remote branch still exists.", "warning");
			return;
		}
	}

	const previousBranch = c.currentBranch;

	if (c.mode === "worktree") {
		const commonDir = await tryExec(exec, "git", ["rev-parse", "--git-common-dir"], signal);
		const topLevel = await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal);
		if (!commonDir || !topLevel) {
			ctx.ui.notify("Failed to resolve main worktree path; aborting cleanup.", "error");
			return;
		}
		const mainPath = commonDir.replace(/\/?\.git\/?$/, "") || ".";
		const result = await removeWorktree(exec, mainPath, topLevel, signal);
		if (!result.ok) {
			ctx.ui.notify(`git worktree remove failed:\n${result.message}`, "error");
			return;
		}
		if (result.message) console.log(result.message);
		console.log(`Removed worktree at ${topLevel}`);
	} else {
		const checkout = await execLoud(exec, "git", ["checkout", c.defaultBranch], signal);
		if (!checkout.ok) {
			ctx.ui.notify(`git checkout ${c.defaultBranch} failed:\n${checkout.out}`, "error");
			return;
		}
		const del = await execLoud(exec, "git", ["branch", "-d", previousBranch], signal);
		if (!del.ok) {
			const force = await execLoud(exec, "git", ["branch", "-D", previousBranch], signal);
			if (!force.ok) {
				ctx.ui.notify(`Failed to delete branch ${previousBranch}:\n${force.out}`, "error");
				return;
			}
			console.log(`Deleted branch ${previousBranch} (force, squash-merge).`);
		} else {
			console.log(`Deleted branch ${previousBranch}.`);
		}
	}

	const fetch = await execLoud(exec, "git", ["fetch", "origin", "--prune"], signal);
	if (!fetch.ok) {
		ctx.ui.notify(`git fetch failed:\n${fetch.out}`, "warning");
	}
	const pull = await execLoud(exec, "git", ["pull", "origin", c.defaultBranch], signal);
	if (!pull.ok) {
		ctx.ui.notify(`git pull failed:\n${pull.out}`, "warning");
	}

	ctx.ui.notify(
		`Landed on \`${c.defaultBranch}\`. Local branch \`${previousBranch}\` cleaned up.`,
		"info",
	);
}

// ── Slash command ────────────────────────────────────────────

export default function gitShipExtension(pi: ExtensionAPI) {
	pi.registerCommand("ship", {
		description:
			"Detect ship state and run the appropriate phase: push+PR, wait, or land. Use `/ship status` to print state without acting.",
		handler: async (args, ctx) => {
			const exec: ExecRunner = (cmd, eargs, opts) => pi.exec(cmd, eargs, opts);
			const signal = ctx.signal;
			const statusOnly = /\bstatus\b/.test(args ?? "");

			const c = await readShipContext(exec, signal);
			const state = detectShipState(c);

			console.log(describeState(state, c));

			if (statusOnly) return;

			switch (state) {
				case "default-clean":
					ctx.ui.notify("Nothing to ship. Use `/create-branch` to start work.", "info");
					return;
				case "default-dirty":
					ctx.ui.notify(
						"Dirty work on default branch. Run `/create-branch` then `/commit-changes`.",
						"warning",
					);
					return;
				case "no-pr":
					await phaseNoPr(exec, c, ctx, signal);
					return;
				case "pr-open":
					await phasePrOpen(c, ctx);
					return;
				case "pr-merged":
					await phasePrMerged(exec, c, ctx, signal);
					return;
				case "pr-closed":
					ctx.ui.notify(
						"PR was closed without merging. Investigate before re-shipping.",
						"warning",
					);
					return;
			}
		},
	});
}
