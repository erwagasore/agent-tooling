/**
 * git-pr — provider-aware PR creation.
 *
 * Exposes a `git_pr` tool that creates a pull/merge request on the host of
 * the current repo's origin remote. Wraps `gh pr create` (GitHub) and
 * `glab mr create` (GitLab). Detects an existing PR for the head branch
 * first and re-uses it when open instead of creating a duplicate.
 *
 * Backed by `_shared/git-internals.ts` — `findExistingPr` and `createPr` are
 * shared with `git-ship` so the same code path is exercised whether a PR is
 * created via the tool (LLM-driven) or via the `/ship` slash command.
 *
 * See SPEC.md § Extensions / git-pr.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
	createPr,
	detectDefaultBranch,
	detectProvider,
	type ExecRunner,
	type ExistingPr,
	findExistingPr,
	type Provider,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Public types ─────────────────────────────────────────────

/**
 * Discriminate via `ok`. Optional fields are populated based on outcome:
 *   ok=true  → `number`, `url`, `reused` are present
 *   ok=false → `reason` is present
 * The shape is intentionally flat so pi's TOutput inference keeps a single type.
 */
export interface GitPrResult {
	ok: boolean;
	provider: Provider;
	number?: number;
	url?: string;
	reused?: boolean;
	reason?: string;
}

const PARAMS = Type.Object({
	title: Type.String({
		description: "PR title (Conventional Commit format).",
		minLength: 1,
	}),
	body: Type.Optional(
		Type.String({ description: "PR body / description. Defaults to empty string." }),
	),
	draft: Type.Optional(
		Type.Boolean({ description: "Open the PR in draft state. Default false." }),
	),
});
export type GitPrParams = Static<typeof PARAMS>;

// ── Helpers ──────────────────────────────────────────────────

function formatSuccess(r: GitPrResult): string {
	const verb = r.reused ? "Re-using existing open" : "Opened";
	return `${verb} PR #${r.number}: ${r.url}`;
}

// ── Extension entrypoint ─────────────────────────────────────

export default function gitPrExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "git_pr",
		label: "Git PR",
		description:
			"Create a pull/merge request for the current branch on the host of origin (GitHub via gh, GitLab via glab). Re-uses an open PR for the same head branch if one already exists. Returns isError: true with structured details on failure.",
		promptSnippet:
			"Open or re-use a PR for the current branch on GitHub or GitLab via gh/glab.",
		promptGuidelines: [
			"Use git_pr to create the PR after pushing a feature branch — it deduplicates against existing open PRs and works across GitHub and GitLab.",
			"git_pr requires the branch to already be pushed; push first, then call git_pr.",
		],
		parameters: PARAMS,
		async execute(_toolCallId, params, signal) {
			const exec: ExecRunner = (cmd, args, opts) => pi.exec(cmd, args, opts);

			const remoteUrl = await tryExec(exec, "git", ["remote", "get-url", "origin"], signal);
			const provider = detectProvider(remoteUrl);
			const currentBranch =
				(await tryExec(exec, "git", ["branch", "--show-current"], signal)) ?? "";
			const defaultBranch = await detectDefaultBranch(exec, signal);

			const fail = (reason: string) => {
				const details: GitPrResult = { ok: false, provider, reason };
				return {
					content: [{ type: "text" as const, text: reason }],
					details,
					isError: true,
				};
			};

			const succeed = (number: number, url: string, reused: boolean) => {
				const details: GitPrResult = { ok: true, provider, number, url, reused };
				return {
					content: [{ type: "text" as const, text: formatSuccess(details) }],
					details,
				};
			};

			// Validation
			if (!remoteUrl) return fail("No `origin` remote is configured.");
			if (provider !== "github" && provider !== "gitlab") {
				return fail(
					`Provider \`${provider}\` is not supported for PR creation. Only \`github\` and \`gitlab\` are supported.`,
				);
			}
			if (!currentBranch) {
				return fail("HEAD is detached. Check out a branch before opening a PR.");
			}
			if (currentBranch === defaultBranch) {
				return fail(`Cannot open a PR from the default branch (\`${defaultBranch}\`).`);
			}

			// Re-use open PR if one exists for this branch
			const existing: ExistingPr | null = await findExistingPr(
				exec,
				provider,
				currentBranch,
				signal,
			);
			if (existing && existing.state === "open") {
				return succeed(existing.number, existing.url, true);
			}

			// Create new PR
			const created = await createPr(
				exec,
				provider,
				{
					title: params.title,
					body: params.body,
					draft: params.draft,
					base: defaultBranch,
					head: currentBranch,
				},
				signal,
			);
			if (!created.ok) {
				return fail(`PR creation failed: ${created.error}`);
			}

			return succeed(created.number, created.url, false);
		},
	});
}
