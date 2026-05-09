/**
 * Shared helpers for the pi-extensions/git-* extensions.
 *
 * This directory has no `index.ts`, so pi does not load it as an extension
 * (see SPEC.md § File layout). Sibling extensions import the helpers via
 * relative path, e.g. `../_shared/git-internals.ts`.
 */

import type { ExecOptions, ExecResult } from "@mariozechner/pi-coding-agent";

// ── Types ────────────────────────────────────────────────────

export type ExecRunner = (cmd: string, args: string[], opts?: ExecOptions) => Promise<ExecResult>;

export type GitMode = "branch" | "worktree";

export type Provider = "github" | "gitlab" | "bitbucket" | "unknown";

export type PrState = "open" | "merged" | "closed";

export interface ExistingPr {
	number: number;
	url: string;
	state: PrState;
}

export interface CreatePrOptions {
	title: string;
	body?: string;
	draft?: boolean;
	base: string;
	head: string;
}

export type CreatePrResult = { ok: true; number: number; url: string } | { ok: false; error: string };

export interface RemoveWorktreeResult {
	ok: boolean;
	message: string;
}

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
export async function detectDefaultBranch(exec: ExecRunner, signal?: AbortSignal): Promise<string> {
	const symRef = await tryExec(exec, "git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], signal);
	if (symRef) return symRef.replace(/^origin\//, "");

	const remoteShow = await tryExec(exec, "git", ["remote", "show", "origin"], signal);
	if (remoteShow) {
		const m = remoteShow.match(/HEAD branch:\s*(\S+)/);
		if (m && m[1] && m[1] !== "(unknown)") return m[1];
	}

	for (const candidate of ["main", "master"]) {
		const ref = await tryExec(exec, "git", ["show-ref", "--verify", `refs/heads/${candidate}`], signal);
		if (ref !== null) return candidate;
	}
	return "main";
}

/**
 * Detect whether the current cwd is a regular checkout (`branch`) or a linked
 * worktree (`worktree`). Returns `"branch"` for non-repos or single-worktree
 * repos so that "branch" stays the safe default.
 */
export async function detectMode(exec: ExecRunner, signal?: AbortSignal): Promise<GitMode> {
	const worktreeList = await tryExec(exec, "git", ["worktree", "list", "--porcelain"], signal);
	const topLevel = await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal);
	if (!worktreeList || !topLevel) return "branch";

	const blocks = worktreeList.split("\n\n").filter(Boolean);
	if (blocks.length <= 1) return "branch";

	const firstPath = blocks[0]?.match(/^worktree\s+(.+)$/m)?.[1];
	return firstPath === topLevel ? "branch" : "worktree";
}

/**
 * Identify the git hosting provider from the origin remote URL.
 */
export function detectProvider(remoteUrl: string | null): Provider {
	if (!remoteUrl) return "unknown";
	if (/github\.com[:/]/i.test(remoteUrl)) return "github";
	if (/gitlab\.[a-z.]+[:/]/i.test(remoteUrl) || /\bgitlab\b/i.test(remoteUrl)) return "gitlab";
	if (/bitbucket\.org[:/]/i.test(remoteUrl)) return "bitbucket";
	return "unknown";
}

function normalizePrState(raw: string): PrState {
	const v = raw.toLowerCase();
	if (v === "merged") return "merged";
	if (v === "closed") return "closed";
	return "open";
}

/**
 * Find an existing PR / MR for the given branch, regardless of state.
 * Returns null when none exists, the provider is unsupported, or the host
 * CLI is unavailable. Soft-failure messages are pushed into `warnings` if a
 * sink is provided.
 */
export async function findExistingPr(
	exec: ExecRunner,
	provider: Provider,
	branch: string,
	signal?: AbortSignal,
	warnings?: string[],
): Promise<ExistingPr | null> {
	if (!branch) return null;

	if (provider === "github") {
		const out = await tryExec(
			exec,
			"gh",
			["pr", "list", "--head", branch, "--state", "all", "--json", "number,url,state", "--limit", "1"],
			signal,
		);
		if (out === null) {
			warnings?.push("gh CLI unavailable or unauthenticated; existingPr left as null");
			return null;
		}
		try {
			const arr = JSON.parse(out) as Array<{ number: number; url: string; state: string }>;
			const p = arr[0];
			if (!p) return null;
			return { number: p.number, url: p.url, state: normalizePrState(p.state) };
		} catch {
			warnings?.push("Failed to parse gh pr list JSON; existingPr left as null");
			return null;
		}
	}

	if (provider === "gitlab") {
		const out = await tryExec(
			exec,
			"glab",
			["mr", "list", "--source-branch", branch, "--all", "--output", "json"],
			signal,
		);
		if (out === null) {
			warnings?.push("glab CLI unavailable or unauthenticated; existingPr left as null");
			return null;
		}
		try {
			const arr = JSON.parse(out) as Array<{ iid: number; web_url: string; state: string }>;
			const p = arr[0];
			if (!p) return null;
			return { number: p.iid, url: p.web_url, state: normalizePrState(p.state) };
		} catch {
			warnings?.push("Failed to parse glab mr list JSON; existingPr left as null");
			return null;
		}
	}

	warnings?.push(`Provider ${provider} not supported for PR detection`);
	return null;
}

/**
 * Remove a linked worktree at `worktreePath` from the main repo at
 * `mainPath`, then prune. Prune failure is informational, not fatal.
 * Used by both `/wt land` (git-worktree) and `/ship`'s pr-merged phase
 * (git-ship) so the same code path runs whichever entry point is taken.
 */
export async function removeWorktree(
	exec: ExecRunner,
	mainPath: string,
	worktreePath: string,
	signal?: AbortSignal,
): Promise<RemoveWorktreeResult> {
	try {
		const remove = await exec("git", ["-C", mainPath, "worktree", "remove", worktreePath], {
			signal,
			timeout: TIMEOUT_MS,
		});
		const removeOut = [remove.stdout, remove.stderr].filter(Boolean).join("\n").trim();
		if (remove.code !== 0 || remove.killed) {
			return {
				ok: false,
				message: removeOut || `git -C ${mainPath} worktree remove ${worktreePath} failed (code ${remove.code})`,
			};
		}
		const prune = await exec("git", ["-C", mainPath, "worktree", "prune"], { signal, timeout: TIMEOUT_MS });
		const pruneOut = [prune.stdout, prune.stderr].filter(Boolean).join("\n").trim();
		const pruneNote = prune.code !== 0 && pruneOut ? `prune note: ${pruneOut}` : "";
		return {
			ok: true,
			message: [removeOut, pruneNote].filter(Boolean).join("\n"),
		};
	} catch (err) {
		return { ok: false, message: String((err as Error).message ?? err) };
	}
}

/**
 * Create a PR on the given provider. Returns the new PR's number and URL on
 * success, or an error message string on failure. Does NOT detect existing
 * PRs — callers (e.g. git-pr) decide whether to short-circuit on duplicates.
 */
export async function createPr(
	exec: ExecRunner,
	provider: Provider,
	opts: CreatePrOptions,
	signal?: AbortSignal,
): Promise<CreatePrResult> {
	if (provider !== "github" && provider !== "gitlab") {
		return { ok: false, error: `Provider ${provider} is not supported for PR creation` };
	}
	const body = opts.body ?? "";
	const cli = provider === "github" ? "gh" : "glab";
	const args =
		provider === "github"
			? [
					"pr",
					"create",
					"--base",
					opts.base,
					"--head",
					opts.head,
					"--title",
					opts.title,
					"--body",
					body,
					...(opts.draft ? ["--draft"] : []),
				]
			: [
					"mr",
					"create",
					"--target-branch",
					opts.base,
					"--source-branch",
					opts.head,
					"--title",
					opts.title,
					"--description",
					body,
					...(opts.draft ? ["--draft"] : []),
					"--yes",
				];

	try {
		const r = await exec(cli, args, { signal, timeout: 60_000 });
		const out = [r.stdout, r.stderr].filter(Boolean).join("\n");
		if (r.code !== 0 || r.killed) {
			return { ok: false, error: out.trim() || `${cli} ${args.join(" ")} failed with code ${r.code}` };
		}
		const urlMatch = out.match(/https?:\/\/\S+/);
		if (!urlMatch) {
			return { ok: false, error: `Could not parse PR URL from CLI output:\n${out}` };
		}
		const url = urlMatch[0].replace(/[)\]\s.,]+$/, "");
		const numberMatch = url.match(/\/(\d+)\/?$/);
		const number = numberMatch ? parseInt(numberMatch[1] ?? "0", 10) : 0;
		return { ok: true, number, url };
	} catch (err) {
		return { ok: false, error: String((err as Error).message ?? err) };
	}
}
