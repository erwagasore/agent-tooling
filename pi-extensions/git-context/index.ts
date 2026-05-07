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
	detectProvider,
	type ExecRunner,
	type ExistingPr,
	findExistingPr,
	type GitMode,
	type PrState,
	type Provider,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Public types ─────────────────────────────────────────────

export type GitProvider = Provider;
export type { GitMode, PrState };

export interface GitContextResult {
	provider: GitProvider;
	defaultBranch: string;
	currentBranch: string;
	mode: GitMode;
	isClean: boolean;
	hasRemote: boolean;
	existingPr: ExistingPr | null;
	warnings: string[];
}

const PARAMS = Type.Object({});
export type GitContextParams = Static<typeof PARAMS>;

// ── Helpers ──────────────────────────────────────────────────

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
				? await findExistingPr(exec, provider, currentBranch, signal, warnings)
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
