/**
 * git-context — one-call git repository introspection.
 *
 * Exposes a `git_context` tool that returns a single struct describing the
 * current repo (provider, branches, worktree mode, cleanliness, remote, PR).
 * Best-effort — fields default to safe values rather than throwing; soft
 * failures are surfaced via a `warnings` array on the result.
 *
 * Replaces the always-paired detect-provider, detect-default-branch, and
 * detect-existing-pr utility skills with one deterministic call.
 *
 * See SPEC.md § Extensions / git-context.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
	detectDefaultBranch,
	detectMode,
	type ExecRunner,
	type GitMode,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Public types ─────────────────────────────────────────────

export type GitProvider = "github" | "gitlab" | "bitbucket" | "unknown";
export type { GitMode };
export type PrState = "open" | "merged" | "closed";

export interface GitContextResult {
	provider: GitProvider;
	defaultBranch: string;
	currentBranch: string;
	mode: GitMode;
	isClean: boolean;
	hasRemote: boolean;
	existingPr: { number: number; url: string; state: PrState } | null;
	warnings: string[];
}

const PARAMS = Type.Object({});
export type GitContextParams = Static<typeof PARAMS>;

// ── Helpers ──────────────────────────────────────────────────

function detectProvider(remoteUrl: string | null): GitProvider {
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

async function detectExistingPr(
	exec: ExecRunner,
	provider: GitProvider,
	branch: string,
	warnings: string[],
	signal?: AbortSignal,
): Promise<GitContextResult["existingPr"]> {
	if (!branch) return null;

	if (provider === "github") {
		const out = await tryExec(
			exec,
			"gh",
			[
				"pr",
				"list",
				"--head",
				branch,
				"--state",
				"all",
				"--json",
				"number,url,state",
				"--limit",
				"1",
			],
			signal,
		);
		if (out === null) {
			warnings.push("gh CLI unavailable or unauthenticated; existingPr left as null");
			return null;
		}
		try {
			const arr = JSON.parse(out) as Array<{ number: number; url: string; state: string }>;
			if (!arr.length) return null;
			const p = arr[0];
			if (!p) return null;
			return { number: p.number, url: p.url, state: normalizePrState(p.state) };
		} catch {
			warnings.push("Failed to parse gh pr list JSON; existingPr left as null");
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
			warnings.push("glab CLI unavailable or unauthenticated; existingPr left as null");
			return null;
		}
		try {
			const arr = JSON.parse(out) as Array<{ iid: number; web_url: string; state: string }>;
			if (!arr.length) return null;
			const p = arr[0];
			if (!p) return null;
			return { number: p.iid, url: p.web_url, state: normalizePrState(p.state) };
		} catch {
			warnings.push("Failed to parse glab mr list JSON; existingPr left as null");
			return null;
		}
	}

	warnings.push(`Provider ${provider} not supported for PR detection`);
	return null;
}

function formatSummary(r: GitContextResult): string {
	const lines = [
		`provider:       ${r.provider}`,
		`defaultBranch:  ${r.defaultBranch}`,
		`currentBranch:  ${r.currentBranch || "(detached)"}`,
		`mode:           ${r.mode}`,
		`isClean:        ${r.isClean}`,
		`hasRemote:      ${r.hasRemote}`,
		`existingPr:     ${
			r.existingPr ? `#${r.existingPr.number} (${r.existingPr.state}) ${r.existingPr.url}` : "none"
		}`,
	];
	if (r.warnings.length) {
		lines.push("", "warnings:", ...r.warnings.map((w) => `  - ${w}`));
	}
	return lines.join("\n");
}

// ── Extension entrypoint ─────────────────────────────────────

export default function gitContextExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "git_context",
		label: "Git Context",
		description:
			"Return one-call introspection of the current git repo: provider, default branch, current branch, worktree mode, cleanliness, remote presence, and any existing PR for the current branch. Best-effort — fields default to safe values when subcommands fail; soft failures are listed in `warnings`.",
		promptSnippet:
			"Inspect the current git repo in one call (provider, branches, mode, clean, remote, PR).",
		promptGuidelines: [
			"Use git_context as the first step of any git workflow that needs repo state — it replaces multiple shell calls and never throws.",
		],
		parameters: PARAMS,
		async execute(_toolCallId, _params, signal) {
			const exec: ExecRunner = (cmd, args, opts) => pi.exec(cmd, args, opts);
			const warnings: string[] = [];

			const remoteUrl = await tryExec(exec, "git", ["remote", "get-url", "origin"], signal);
			const provider = detectProvider(remoteUrl);
			const hasRemote = remoteUrl !== null;

			const currentBranch =
				(await tryExec(exec, "git", ["branch", "--show-current"], signal)) ?? "";
			const defaultBranch = await detectDefaultBranch(exec, signal);
			const mode = await detectMode(exec, signal);

			const status = await tryExec(exec, "git", ["status", "--porcelain"], signal);
			const isClean = status === "";

			const existingPr = hasRemote
				? await detectExistingPr(exec, provider, currentBranch, warnings, signal)
				: null;

			const result: GitContextResult = {
				provider,
				defaultBranch,
				currentBranch,
				mode,
				isClean,
				hasRemote,
				existingPr,
				warnings,
			};

			return {
				content: [{ type: "text", text: formatSummary(result) }],
				details: result,
			};
		},
	});
}
