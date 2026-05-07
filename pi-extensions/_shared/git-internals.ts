/**
 * Shared helpers for the pi-extensions/git-* extensions.
 *
 * This directory has no `index.ts`, so pi does not load it as an extension
 * (see SPEC.md § File layout). Sibling extensions import the helpers via
 * relative path, e.g. `../_shared/git-internals.ts`.
 */

import type { ExecOptions, ExecResult } from "@mariozechner/pi-coding-agent";

// ── Types ────────────────────────────────────────────────────

export type ExecRunner = (
	cmd: string,
	args: string[],
	opts?: ExecOptions,
) => Promise<ExecResult>;

export type GitMode = "branch" | "worktree";

// ── Constants ────────────────────────────────────────────────

export const TIMEOUT_MS = 10_000;

// ── Helpers ──────────────────────────────────────────────────

/**
 * Run a shell command best-effort. Returns trimmed stdout on success, or
 * `null` on non-zero exit, kill, or thrown error. Never throws.
 */
export async function tryExec(
	exec: ExecRunner,
	cmd: string,
	args: string[],
	signal?: AbortSignal,
): Promise<string | null> {
	try {
		const r = await exec(cmd, args, { signal, timeout: TIMEOUT_MS });
		if (r.code !== 0 || r.killed) return null;
		return r.stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Resolve the repo's default branch name. Tries:
 *   1. `git symbolic-ref refs/remotes/origin/HEAD`
 *   2. parsing `git remote show origin`
 *   3. local existence check for `main`/`master`
 *   4. fallback: "main"
 */
export async function detectDefaultBranch(
	exec: ExecRunner,
	signal?: AbortSignal,
): Promise<string> {
	const symRef = await tryExec(
		exec,
		"git",
		["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
		signal,
	);
	if (symRef) return symRef.replace(/^origin\//, "");

	const remoteShow = await tryExec(exec, "git", ["remote", "show", "origin"], signal);
	if (remoteShow) {
		const m = remoteShow.match(/HEAD branch:\s*(\S+)/);
		if (m && m[1] && m[1] !== "(unknown)") return m[1];
	}

	for (const candidate of ["main", "master"]) {
		const ref = await tryExec(
			exec,
			"git",
			["show-ref", "--verify", `refs/heads/${candidate}`],
			signal,
		);
		if (ref !== null) return candidate;
	}
	return "main";
}

/**
 * Detect whether the current cwd is a regular checkout (`branch`) or a linked
 * worktree (`worktree`). Returns `"branch"` for non-repos or single-worktree
 * repos so that "branch" stays the safe default.
 */
export async function detectMode(
	exec: ExecRunner,
	signal?: AbortSignal,
): Promise<GitMode> {
	const worktreeList = await tryExec(exec, "git", ["worktree", "list", "--porcelain"], signal);
	const topLevel = await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal);
	if (!worktreeList || !topLevel) return "branch";

	const blocks = worktreeList.split("\n\n").filter(Boolean);
	if (blocks.length <= 1) return "branch";

	const firstPath = blocks[0]?.match(/^worktree\s+(.+)$/m)?.[1];
	return firstPath === topLevel ? "branch" : "worktree";
}
