import { describe, expect, it } from "vitest";
import gitGuardExtension from "../pi-extensions/git-guard/index.ts";
import type { ExecRunner } from "../pi-extensions/_shared/git-internals.ts";
import { createMockPi } from "./helpers/pi-harness.ts";

function execFrom(
	handler: (
		cmd: string,
		args: string[],
	) => { stdout?: string; stderr?: string; code?: number; killed?: boolean },
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

function repoExec(
	opts: {
		remote?: boolean;
		status?: string | null;
		currentBranch?: string;
		defaultBranch?: string;
		mode?: "branch" | "worktree";
	} = {},
): ExecRunner {
	const remote = opts.remote ?? true;
	const status = opts.status ?? "";
	const currentBranch = opts.currentBranch ?? "feat/foo";
	const defaultBranch = opts.defaultBranch ?? "main";
	const mode = opts.mode ?? "branch";

	return execFrom((cmd, args) => {
		const key = `${cmd} ${args.join(" ")}`;
		switch (key) {
			case "git remote get-url origin":
				return remote ? { stdout: "git@github.com:owner/repo.git\n" } : { stderr: "No such remote", code: 2 };
			case "git status --porcelain":
				return status === null ? { stderr: "not a repo", code: 128 } : { stdout: status };
			case "git branch --show-current":
				return { stdout: `${currentBranch}\n` };
			case "git symbolic-ref --short refs/remotes/origin/HEAD":
				return { stdout: `origin/${defaultBranch}\n` };
			case "git worktree list --porcelain":
				return mode === "branch"
					? { stdout: `worktree /repo/main\nHEAD abc\nbranch refs/heads/${currentBranch}\n` }
					: {
							stdout: [
								"worktree /repo/main",
								"HEAD abc",
								`branch refs/heads/${defaultBranch}`,
								"",
								"worktree /repo/repo-feat-foo",
								"HEAD def",
								`branch refs/heads/${currentBranch}`,
							].join("\n"),
						};
			case "git rev-parse --show-toplevel":
				return { stdout: mode === "branch" ? "/repo/main\n" : "/repo/repo-feat-foo\n" };
			default:
				return { stderr: `unexpected command: ${key}`, code: 1 };
		}
	});
}

async function executeGitGuard(exec: ExecRunner, params: Record<string, unknown>) {
	const { pi, tools } = createMockPi(exec);
	gitGuardExtension(pi);
	const tool = tools.get("git_guard");
	expect(tool).toBeDefined();
	return await (tool!.execute as any)("tool-call-id", params, undefined);
}

describe("git-guard tool", () => {
	it("registers git_guard metadata", () => {
		const { pi, tools } = createMockPi();
		gitGuardExtension(pi);

		const tool = tools.get("git_guard");
		expect(tool?.label).toBe("Git Guard");
		expect(tool?.description).toContain("clean tree");
		expect(tool?.promptGuidelines).toHaveLength(2);
	});

	it("passes requested checks and returns formatted OK summary", async () => {
		const result = await executeGitGuard(
			repoExec({ currentBranch: "main", defaultBranch: "main", mode: "branch", remote: true, status: "" }),
			{ requireClean: true, requireRemote: true, requireBranch: "default", requireMode: "branch" },
		);

		expect(result.isError).toBe(false);
		expect(result.details).toEqual({
			ok: true,
			failures: [],
			state: {
				isClean: true,
				hasRemote: true,
				currentBranch: "main",
				defaultBranch: "main",
				mode: "branch",
			},
		});
		expect(result.content[0].text).toContain("Guard OK");
		expect(result.content[0].text).toContain("✓ requireClean");
	});

	it("supports no-op guards with no requested checks", async () => {
		const result = await executeGitGuard(repoExec(), {});

		expect(result.isError).toBe(false);
		expect(result.details.ok).toBe(true);
		expect(result.content[0].text).toContain("(no checks requested)");
	});

	it("fails requireClean for dirty worktrees", async () => {
		const result = await executeGitGuard(repoExec({ status: " M README.md\n" }), { requireClean: true });

		expect(result.isError).toBe(true);
		expect(result.details.failures).toEqual([
			{ check: "requireClean", message: "Working tree has uncommitted changes." },
		]);
		expect(result.content[0].text).toContain("Guard FAILED");
		expect(result.content[0].text).toContain("isClean:       false");
	});

	it("fails requireRemote when origin is missing", async () => {
		const result = await executeGitGuard(repoExec({ remote: false }), { requireRemote: true });

		expect(result.isError).toBe(true);
		expect(result.details.failures).toEqual([
			{ check: "requireRemote", message: "No `origin` remote is configured." },
		]);
	});

	it("fails default branch requirements for feature branches and detached HEAD", async () => {
		await expect(
			executeGitGuard(repoExec({ currentBranch: "feat/foo", defaultBranch: "main" }), {
				requireBranch: "default",
			}),
		).resolves.toMatchObject({
			isError: true,
			details: {
				failures: [
					{
						check: "requireBranch",
						message: "Currently on `feat/foo`; expected default branch `main`.",
					},
				],
			},
		});

		await expect(
			executeGitGuard(repoExec({ currentBranch: "" }), { requireBranch: "default" }),
		).resolves.toMatchObject({
			isError: true,
			details: {
				failures: [
					{
						check: "requireBranch",
						message: "HEAD is detached; expected to be on the default branch.",
					},
				],
			},
		});
	});

	it("fails non-default branch requirements for default branch and detached HEAD", async () => {
		await expect(
			executeGitGuard(repoExec({ currentBranch: "main", defaultBranch: "main" }), {
				requireBranch: "non-default",
			}),
		).resolves.toMatchObject({
			isError: true,
			details: {
				failures: [
					{
						check: "requireBranch",
						message: "Currently on default branch `main`; expected a non-default branch.",
					},
				],
			},
		});

		await expect(
			executeGitGuard(repoExec({ currentBranch: "" }), { requireBranch: "non-default" }),
		).resolves.toMatchObject({
			isError: true,
			details: {
				failures: [
					{
						check: "requireBranch",
						message: "HEAD is detached; expected to be on a non-default branch.",
					},
				],
			},
		});
	});

	it("fails requireMode when branch/worktree mode differs", async () => {
		const result = await executeGitGuard(repoExec({ mode: "worktree" }), { requireMode: "branch" });

		expect(result.isError).toBe(true);
		expect(result.details.failures).toEqual([
			{ check: "requireMode", message: "Repo is in `worktree` mode; expected `branch`." },
		]);
	});

	it("aggregates multiple failures without short-circuiting", async () => {
		const result = await executeGitGuard(
			repoExec({
				remote: false,
				status: " M README.md\n",
				currentBranch: "main",
				defaultBranch: "main",
				mode: "branch",
			}),
			{
				requireClean: true,
				requireRemote: true,
				requireBranch: "non-default",
				requireMode: "worktree",
			},
		);

		expect(result.isError).toBe(true);
		expect(result.details.failures).toEqual([
			{ check: "requireClean", message: "Working tree has uncommitted changes." },
			{ check: "requireRemote", message: "No `origin` remote is configured." },
			{
				check: "requireBranch",
				message: "Currently on default branch `main`; expected a non-default branch.",
			},
			{ check: "requireMode", message: "Repo is in `branch` mode; expected `worktree`." },
		]);
		expect(result.content[0].text).toContain("✗ requireClean");
		expect(result.content[0].text).toContain("currentBranch: main");
	});
});
