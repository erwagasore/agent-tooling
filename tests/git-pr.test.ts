import { describe, expect, it } from "vitest";
import gitPrExtension from "../pi-extensions/git-pr/index.ts";
import type { ExecRunner } from "../pi-extensions/_shared/git-internals.ts";
import { createMockPi } from "./helpers/pi-harness.ts";

function execFrom(
	handler: (cmd: string, args: string[]) => { stdout?: string; stderr?: string; code?: number; killed?: boolean },
): ExecRunner {
	return async (cmd, args) => {
		const r = handler(cmd, args);
		return {
			stdout: r.stdout ?? "",
			stderr: r.stderr ?? "",
			code: r.code ?? 0,
			killed: r.killed ?? false,
		};
	};
}

function repoExec(opts: {
	remoteUrl?: string | null;
	currentBranch?: string;
	defaultBranch?: string;
	existingPr?: Array<{ number?: number; url?: string; state?: string }> | null;
	createOut?: string;
	createCode?: number;
} = {}): ExecRunner {
	const remoteUrl = opts.remoteUrl === undefined ? "git@github.com:owner/repo.git" : opts.remoteUrl;
	const currentBranch = opts.currentBranch ?? "feat/foo";
	const defaultBranch = opts.defaultBranch ?? "main";
	const existingPr = opts.existingPr ?? [];

	return execFrom((cmd, args) => {
		const key = `${cmd} ${args.join(" ")}`;
		switch (key) {
			case "git remote get-url origin":
				return remoteUrl ? { stdout: `${remoteUrl}\n` } : { stderr: "No such remote", code: 2 };
			case "git branch --show-current":
				return { stdout: `${currentBranch}\n` };
			case "git symbolic-ref --short refs/remotes/origin/HEAD":
				return { stdout: `origin/${defaultBranch}\n` };
		}

		if (key.startsWith("gh pr list")) {
			return existingPr === null
				? { stderr: "not authenticated", code: 1 }
				: { stdout: JSON.stringify(existingPr) };
		}
		if (key.startsWith("glab mr list")) {
			return existingPr === null
				? { stderr: "not authenticated", code: 1 }
				: { stdout: JSON.stringify(existingPr) };
		}
		if (key.startsWith("gh pr create")) {
			return { stdout: opts.createOut ?? "https://github.com/owner/repo/pull/99\n", code: opts.createCode ?? 0 };
		}
		if (key.startsWith("glab mr create")) {
			return { stdout: opts.createOut ?? "https://gitlab.com/owner/repo/-/merge_requests/7\n", code: opts.createCode ?? 0 };
		}

		return { stderr: `unexpected command: ${key}`, code: 1 };
	});
}

async function executeGitPr(exec: ExecRunner, params: Record<string, unknown>) {
	const { pi, tools } = createMockPi(exec);
	gitPrExtension(pi);
	const tool = tools.get("git_pr");
	expect(tool).toBeDefined();
	return await (tool!.execute as any)("tool-call-id", params, undefined);
}

describe("git-pr tool", () => {
	it("registers git_pr metadata", () => {
		const { pi, tools } = createMockPi();
		gitPrExtension(pi);

		const tool = tools.get("git_pr");
		expect(tool?.label).toBe("Git PR");
		expect(tool?.description).toContain("Create a pull/merge request");
		expect(tool?.promptGuidelines?.[0]).toContain("deduplicates");
	});

	it("fails when no origin remote is configured", async () => {
		const result = await executeGitPr(repoExec({ remoteUrl: null }), { title: "feat: add foo" });

		expect(result.isError).toBe(true);
		expect(result.details).toEqual({
			ok: false,
			provider: "unknown",
			reason: "No `origin` remote is configured.",
		});
	});

	it("fails unsupported providers before creating", async () => {
		const result = await executeGitPr(repoExec({ remoteUrl: "https://bitbucket.org/o/r.git" }), {
			title: "feat: add foo",
		});

		expect(result.isError).toBe(true);
		expect(result.details).toEqual({
			ok: false,
			provider: "bitbucket",
			reason: "Provider `bitbucket` is not supported for PR creation. Only `github` and `gitlab` are supported.",
		});
	});

	it("fails on detached HEAD", async () => {
		const result = await executeGitPr(repoExec({ currentBranch: "" }), { title: "feat: add foo" });

		expect(result.isError).toBe(true);
		expect(result.details).toMatchObject({
			ok: false,
			provider: "github",
			reason: "HEAD is detached. Check out a branch before opening a PR.",
		});
	});

	it("fails on the default branch", async () => {
		const result = await executeGitPr(repoExec({ currentBranch: "main", defaultBranch: "main" }), {
			title: "feat: add foo",
		});

		expect(result.isError).toBe(true);
		expect(result.details).toMatchObject({
			ok: false,
			provider: "github",
			reason: "Cannot open a PR from the default branch (`main`).",
		});
	});

	it("reuses an existing open GitHub PR", async () => {
		const result = await executeGitPr(
			repoExec({
				existingPr: [{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "OPEN" }],
			}),
			{ title: "feat: add foo" },
		);

		expect(result.isError).toBeUndefined();
		expect(result.details).toEqual({
			ok: true,
			provider: "github",
			number: 12,
			url: "https://github.com/owner/repo/pull/12",
			reused: true,
		});
		expect(result.content[0].text).toContain("Re-using existing open PR #12");
	});

	it("does not reuse closed or merged PRs and creates a new GitHub PR", async () => {
		const result = await executeGitPr(
			repoExec({
				existingPr: [{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "CLOSED" }],
				createOut: "https://github.com/owner/repo/pull/99\n",
			}),
			{ title: "feat: add foo", body: "body", draft: true },
		);

		expect(result.isError).toBeUndefined();
		expect(result.details).toEqual({
			ok: true,
			provider: "github",
			number: 99,
			url: "https://github.com/owner/repo/pull/99",
			reused: false,
		});
		expect(result.content[0].text).toContain("Opened PR #99");
	});

	it("creates a GitLab MR", async () => {
		const result = await executeGitPr(
			repoExec({
				remoteUrl: "https://gitlab.com/owner/repo.git",
				existingPr: [],
				createOut: "https://gitlab.com/owner/repo/-/merge_requests/7\n",
			}),
			{ title: "feat: add foo", body: "body" },
		);

		expect(result.isError).toBeUndefined();
		expect(result.details).toEqual({
			ok: true,
			provider: "gitlab",
			number: 7,
			url: "https://gitlab.com/owner/repo/-/merge_requests/7",
			reused: false,
		});
	});

	it("surfaces PR creation failures", async () => {
		const result = await executeGitPr(
			repoExec({ existingPr: [], createOut: "not authenticated", createCode: 1 }),
			{ title: "feat: add foo" },
		);

		expect(result.isError).toBe(true);
		expect(result.details).toEqual({
			ok: false,
			provider: "github",
			reason: "PR creation failed: not authenticated",
		});
	});
});
