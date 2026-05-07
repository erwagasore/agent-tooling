/**
 * git-worktree — branch-vs-worktree fork hidden behind `/wt`.
 *
 *   /wt new <name>   → create a linked worktree at `../<repo>-<sanitized-name>`
 *                      on a new branch <name> based on the default branch.
 *   /wt land         → from inside a linked worktree, remove it and prune.
 *   /wt list         → print all worktrees in a friendly table.
 *
 * The extension cannot `cd` for the user (pi runs in a single cwd). It prints
 * the destination path with a `cd` hint after each operation; the user runs
 * the actual cd in their shell.
 *
 * See SPEC.md § Extensions / git-worktree and § Conventions / Worktree mode.
 */

import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import {
	detectDefaultBranch,
	detectMode,
	type ExecRunner,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Helpers ──────────────────────────────────────────────────

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

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function getMainRepoPath(exec: ExecRunner, signal?: AbortSignal): Promise<string | null> {
	const commonDir = await tryExec(exec, "git", ["rev-parse", "--git-common-dir"], signal);
	if (!commonDir) return null;
	// commonDir is typically "<main>/.git" or just ".git" (relative); strip the suffix
	const stripped = commonDir.replace(/\/?\.git\/?$/, "") || ".";
	return resolve(stripped);
}

function sanitizeForPath(branch: string): string {
	return branch.replace(/[/\\]+/g, "-").replace(/[^A-Za-z0-9._-]/g, "-");
}

// ── /wt new ──────────────────────────────────────────────────

async function wtNew(
	branchName: string,
	exec: ExecRunner,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	if (!branchName) {
		ctx.ui.notify(
			"Usage: `/wt new <branch-name>` — e.g. `/wt new feat/foo` or `/wt new wip/2026-05-07`.",
			"warning",
		);
		return;
	}
	if (/\s/.test(branchName)) {
		ctx.ui.notify(`Branch name cannot contain whitespace: \`${branchName}\``, "error");
		return;
	}

	const mainPath = await getMainRepoPath(exec, signal);
	if (!mainPath) {
		ctx.ui.notify("Not inside a git repository.", "error");
		return;
	}

	const repoName = basename(mainPath);
	const worktreePath = resolve(mainPath, "..", `${repoName}-${sanitizeForPath(branchName)}`);

	if (await fileExists(worktreePath)) {
		ctx.ui.notify(`Path already exists: \`${worktreePath}\`. Pick a different name.`, "error");
		return;
	}

	// Refuse to clobber an existing branch
	const branchRef = await tryExec(
		exec,
		"git",
		["-C", mainPath, "show-ref", "--verify", `refs/heads/${branchName}`],
		signal,
	);
	if (branchRef !== null) {
		ctx.ui.notify(
			`Branch \`${branchName}\` already exists locally. Use \`git worktree add ${worktreePath} ${branchName}\` to attach to it, or pick a different name.`,
			"error",
		);
		return;
	}

	const defaultBranch = await detectDefaultBranch(exec, signal);

	const ok = await ctx.ui.confirm(
		"Create worktree?",
		`Branch \`${branchName}\` based on \`${defaultBranch}\`, worktree at \`${worktreePath}\`.`,
	);
	if (!ok) {
		ctx.ui.notify("Worktree creation cancelled.", "info");
		return;
	}

	const created = await execLoud(
		exec,
		"git",
		[
			"-C",
			mainPath,
			"worktree",
			"add",
			worktreePath,
			"-b",
			branchName,
			defaultBranch,
		],
		signal,
	);
	if (!created.ok) {
		ctx.ui.notify(`git worktree add failed:\n${created.out}`, "error");
		return;
	}
	console.log(created.out);
	console.log(`\nWorktree ready at: ${worktreePath}`);
	console.log(`cd into it:\n  cd "${worktreePath}"`);
	ctx.ui.notify(`Worktree \`${branchName}\` created. cd to: ${worktreePath}`, "info");
}

// ── /wt land ─────────────────────────────────────────────────

async function wtLand(
	exec: ExecRunner,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	const mode = await detectMode(exec, signal);
	if (mode !== "worktree") {
		ctx.ui.notify(
			"Not inside a linked worktree. `/wt land` only runs from a worktree created via `/wt new`.",
			"warning",
		);
		return;
	}

	const topLevel = await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal);
	const mainPath = await getMainRepoPath(exec, signal);
	if (!topLevel || !mainPath) {
		ctx.ui.notify("Failed to resolve worktree paths; aborting.", "error");
		return;
	}

	const ok = await ctx.ui.confirm(
		"Land worktree?",
		`Remove worktree at \`${topLevel}\` and prune. Main repo: \`${mainPath}\`.`,
	);
	if (!ok) {
		ctx.ui.notify("Land cancelled.", "info");
		return;
	}

	const remove = await execLoud(
		exec,
		"git",
		["-C", mainPath, "worktree", "remove", topLevel],
		signal,
	);
	if (!remove.ok) {
		ctx.ui.notify(
			`git worktree remove failed:\n${remove.out}\n\nIf the worktree has uncommitted changes, commit/stash first or pass --force manually.`,
			"error",
		);
		return;
	}
	const prune = await execLoud(exec, "git", ["-C", mainPath, "worktree", "prune"], signal);
	if (!prune.ok) {
		// Non-fatal — removal already succeeded
		console.log(`Note: worktree prune emitted: ${prune.out}`);
	}

	console.log(`Removed worktree at: ${topLevel}`);
	console.log(`cd back to main repo:\n  cd "${mainPath}"`);
	ctx.ui.notify(`Worktree removed. cd to: ${mainPath}`, "info");
}

// ── /wt list ─────────────────────────────────────────────────

interface WorktreeEntry {
	path: string;
	head: string;
	branch: string | null;
	bare: boolean;
	detached: boolean;
}

function parseWorktreeList(out: string): WorktreeEntry[] {
	const blocks = out.split("\n\n").map((b) => b.trim()).filter(Boolean);
	return blocks.map((block) => {
		const lines = block.split("\n");
		const entry: WorktreeEntry = {
			path: "",
			head: "",
			branch: null,
			bare: false,
			detached: false,
		};
		for (const line of lines) {
			if (line.startsWith("worktree ")) entry.path = line.slice("worktree ".length);
			else if (line.startsWith("HEAD ")) entry.head = line.slice("HEAD ".length);
			else if (line.startsWith("branch ")) {
				entry.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
			} else if (line === "bare") entry.bare = true;
			else if (line === "detached") entry.detached = true;
		}
		return entry;
	});
}

function formatWorktreeTable(entries: WorktreeEntry[]): string {
	if (entries.length === 0) return "(no worktrees)";
	const rows = entries.map((e) => ({
		path: e.path,
		ref: e.bare ? "(bare)" : e.detached ? `(detached @ ${e.head.slice(0, 7)})` : e.branch ?? "(unknown)",
		head: e.head.slice(0, 7),
	}));
	const pathW = Math.max(4, ...rows.map((r) => r.path.length));
	const refW = Math.max(6, ...rows.map((r) => r.ref.length));
	const headW = 7;
	const header = `${"PATH".padEnd(pathW)}  ${"BRANCH".padEnd(refW)}  ${"HEAD".padEnd(headW)}`;
	const sep = `${"-".repeat(pathW)}  ${"-".repeat(refW)}  ${"-".repeat(headW)}`;
	const body = rows
		.map((r) => `${r.path.padEnd(pathW)}  ${r.ref.padEnd(refW)}  ${r.head.padEnd(headW)}`)
		.join("\n");
	return `${header}\n${sep}\n${body}`;
}

async function wtList(
	exec: ExecRunner,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	const out = await tryExec(exec, "git", ["worktree", "list", "--porcelain"], signal);
	if (out === null) {
		ctx.ui.notify("Not inside a git repository (or `git worktree list` failed).", "error");
		return;
	}
	const entries = parseWorktreeList(out);
	console.log(formatWorktreeTable(entries));
}

// ── Slash command ────────────────────────────────────────────

export default function gitWorktreeExtension(pi: ExtensionAPI) {
	pi.registerCommand("wt", {
		description:
			"Manage git worktrees: `/wt new <branch>` creates a linked worktree, `/wt land` removes the current one, `/wt list` lists all of them.",
		handler: async (args, ctx) => {
			const exec: ExecRunner = (cmd, eargs, opts) => pi.exec(cmd, eargs, opts);
			const signal = ctx.signal;
			const trimmed = (args ?? "").trim();
			const [subRaw, ...rest] = trimmed.split(/\s+/);
			const sub = (subRaw ?? "").toLowerCase();
			const subArgs = rest.join(" ").trim();

			switch (sub) {
				case "":
				case "list":
					await wtList(exec, ctx, signal);
					return;
				case "new":
					await wtNew(subArgs, exec, ctx, signal);
					return;
				case "land":
					await wtLand(exec, ctx, signal);
					return;
				default:
					ctx.ui.notify(
						`Unknown subcommand: \`${sub}\`. Use \`/wt new <branch>\`, \`/wt land\`, or \`/wt list\`.`,
						"warning",
					);
			}
		},
	});
}

// ── Re-exports for tests ─────────────────────────────────────

export { sanitizeForPath, parseWorktreeList, formatWorktreeTable };
