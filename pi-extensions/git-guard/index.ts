/**
 * git-guard — declarative repo-state assertions.
 *
 * Exposes a `git_guard` tool that checks one or more requirements about the
 * current git repo (clean tree, remote present, on/off default branch, branch
 * vs worktree mode). When any required check fails, the tool returns
 * `isError: true` with a structured `failures` array so callers can react.
 *
 * Replaces the always-paired check-preflight + check-worktree skills.
 *
 * See SPEC.md § Extensions / git-guard.
 */

import type { ExecOptions, ExecResult, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "typebox";

// ── Public types ─────────────────────────────────────────────

export type GuardCheck =
	| "requireClean"
	| "requireRemote"
	| "requireBranch"
	| "requireMode";

export interface GuardFailure {
	check: GuardCheck;
	message: string;
}

export interface GuardState {
	isClean: boolean;
	hasRemote: boolean;
	currentBranch: string;
	defaultBranch: string;
	mode: "branch" | "worktree";
}

export interface GitGuardResult {
	ok: boolean;
	failures: GuardFailure[];
	state: GuardState;
}

const PARAMS = Type.Object({
	requireClean: Type.Optional(
		Type.Boolean({ description: "Require working tree to have no uncommitted changes." }),
	),
	requireRemote: Type.Optional(
		Type.Boolean({ description: "Require an `origin` remote to be configured." }),
	),
	requireBranch: Type.Optional(
		Type.Union(
			[Type.Literal("default"), Type.Literal("non-default")],
			{
				description:
					"Require the current branch to be the default branch (`default`) or any other branch (`non-default`).",
			},
		),
	),
	requireMode: Type.Optional(
		Type.Union(
			[Type.Literal("branch"), Type.Literal("worktree")],
			{ description: "Require the repo to be in regular branch or linked-worktree mode." },
		),
	),
});
export type GitGuardParams = Static<typeof PARAMS>;

// ── Helpers ──────────────────────────────────────────────────

type ExecRunner = (cmd: string, args: string[], opts?: ExecOptions) => Promise<ExecResult>;
const TIMEOUT_MS = 10_000;

async function tryExec(
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

async function detectDefaultBranch(exec: ExecRunner, signal?: AbortSignal): Promise<string> {
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

async function detectMode(exec: ExecRunner, signal?: AbortSignal): Promise<"branch" | "worktree"> {
	const worktreeList = await tryExec(exec, "git", ["worktree", "list", "--porcelain"], signal);
	const topLevel = await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal);
	if (!worktreeList || !topLevel) return "branch";

	const blocks = worktreeList.split("\n\n").filter(Boolean);
	if (blocks.length <= 1) return "branch";

	const firstPath = blocks[0]?.match(/^worktree\s+(.+)$/m)?.[1];
	return firstPath === topLevel ? "branch" : "worktree";
}

async function readState(exec: ExecRunner, signal?: AbortSignal): Promise<GuardState> {
	const remoteUrl = await tryExec(exec, "git", ["remote", "get-url", "origin"], signal);
	const status = await tryExec(exec, "git", ["status", "--porcelain"], signal);
	const currentBranch =
		(await tryExec(exec, "git", ["branch", "--show-current"], signal)) ?? "";
	const defaultBranch = await detectDefaultBranch(exec, signal);
	const mode = await detectMode(exec, signal);

	return {
		isClean: status === "",
		hasRemote: remoteUrl !== null,
		currentBranch,
		defaultBranch,
		mode,
	};
}

function evaluateChecks(opts: GitGuardParams, state: GuardState): GuardFailure[] {
	const failures: GuardFailure[] = [];

	if (opts.requireClean && !state.isClean) {
		failures.push({
			check: "requireClean",
			message: "Working tree has uncommitted changes.",
		});
	}

	if (opts.requireRemote && !state.hasRemote) {
		failures.push({
			check: "requireRemote",
			message: "No `origin` remote is configured.",
		});
	}

	if (opts.requireBranch === "default") {
		if (!state.currentBranch) {
			failures.push({
				check: "requireBranch",
				message: "HEAD is detached; expected to be on the default branch.",
			});
		} else if (state.currentBranch !== state.defaultBranch) {
			failures.push({
				check: "requireBranch",
				message: `Currently on \`${state.currentBranch}\`; expected default branch \`${state.defaultBranch}\`.`,
			});
		}
	} else if (opts.requireBranch === "non-default") {
		if (!state.currentBranch) {
			failures.push({
				check: "requireBranch",
				message: "HEAD is detached; expected to be on a non-default branch.",
			});
		} else if (state.currentBranch === state.defaultBranch) {
			failures.push({
				check: "requireBranch",
				message: `Currently on default branch \`${state.defaultBranch}\`; expected a non-default branch.`,
			});
		}
	}

	if (opts.requireMode && state.mode !== opts.requireMode) {
		failures.push({
			check: "requireMode",
			message: `Repo is in \`${state.mode}\` mode; expected \`${opts.requireMode}\`.`,
		});
	}

	return failures;
}

function formatSummary(result: GitGuardResult, opts: GitGuardParams): string {
	const requested = (Object.keys(opts) as Array<keyof GitGuardParams>).filter(
		(k) => opts[k] !== undefined,
	);

	if (result.ok) {
		const passed = requested.length
			? requested.map((k) => `  ✓ ${k}`).join("\n")
			: "  (no checks requested)";
		return `Guard OK\n${passed}`;
	}

	const lines = ["Guard FAILED"];
	for (const f of result.failures) {
		lines.push(`  ✗ ${f.check}: ${f.message}`);
	}
	lines.push("", "state:");
	lines.push(`  isClean:       ${result.state.isClean}`);
	lines.push(`  hasRemote:     ${result.state.hasRemote}`);
	lines.push(`  currentBranch: ${result.state.currentBranch || "(detached)"}`);
	lines.push(`  defaultBranch: ${result.state.defaultBranch}`);
	lines.push(`  mode:          ${result.state.mode}`);
	return lines.join("\n");
}

// ── Extension entrypoint ─────────────────────────────────────

export default function gitGuardExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "git_guard",
		label: "Git Guard",
		description:
			"Assert one or more requirements about the current git repo: clean tree, remote present, on/off default branch, branch-vs-worktree mode. Returns isError: true with a structured `failures` array when any required check fails. Checks not specified in args are skipped.",
		promptSnippet:
			"Assert repo state at the start of a workflow (clean, remote, branch, mode). Fails closed.",
		promptGuidelines: [
			"Use git_guard at the start of any git workflow that has preconditions — it replaces the paired check-preflight and check-worktree skills.",
			"Pass only the checks you need; omitted opts are skipped, not enforced.",
		],
		parameters: PARAMS,
		async execute(_toolCallId, params, signal) {
			const exec: ExecRunner = (cmd, args, opts) => pi.exec(cmd, args, opts);

			const state = await readState(exec, signal);
			const failures = evaluateChecks(params, state);
			const result: GitGuardResult = {
				ok: failures.length === 0,
				failures,
				state,
			};

			return {
				content: [{ type: "text", text: formatSummary(result, params) }],
				details: result,
				isError: !result.ok,
			};
		},
	});
}
