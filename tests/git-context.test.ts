import { describe, expect, it } from "vitest";
import gitContextExtension from "../pi-extensions/git-context/index.ts";
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

async function executeGitContext(exec: ExecRunner) {
	const { pi, tools } = createMockPi(exec);
	gitContextExtension(pi);
	const tool = tools.get("git_context");
	expect(tool).toBeDefined();
	return await (tool!.execute as any)("tool-call-id", {}, undefined);
}

describe("git-context tool", () => {
	it("registers git_context metadata", () => {
		const { pi, tools } = createMockPi();
		gitContextExtension(pi);

		const tool = tools.get("git_context");
		expect(tool?.label).toBe("Git Context");
		expect(tool?.description).toContain("one-call introspection");
		expect(tool?.promptGuidelines?.[0]).toContain("first step");
	});

	it("returns full repo context with an existing GitHub PR", async () => {
		const exec = execFrom((cmd, args) => {
			const key = `${cmd} ${args.join(" ")}`;
			switch (key) {
				case "git remote get-url origin":
					return { stdout: "git@github.com:owner/repo.git\n" };
				case "git branch --show-current":
					return { stdout: "feat/foo\n" };
				case "git symbolic-ref --short refs/remotes/origin/HEAD":
					return { stdout: "origin/main\n" };
				case "git worktree list --porcelain":
					return { stdout: "worktree /repo/main\nHEAD abc\nbranch refs/heads/feat/foo\n" };
				case "git rev-parse --show-toplevel":
					return { stdout: "/repo/main\n" };
				case "git status --porcelain":
					return { stdout: "" };
				case "gh pr list --head feat/foo --state all --json number,url,state --limit 1":
					return {
						stdout: JSON.stringify([{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "OPEN" }]),
					};
				default:
					return { stderr: `unexpected command: ${key}`, code: 1 };
			}
		});

		const result = await executeGitContext(exec);

		expect(result.details).toEqual({
			provider: "github",
			defaultBranch: "main",
			currentBranch: "feat/foo",
			mode: "branch",
			isClean: true,
			hasRemote: true,
			existingPr: {
				number: 12,
				url: "https://github.com/owner/repo/pull/12",
				state: "open",
			},
			warnings: [],
		});
		expect(result.content[0].text).toContain("provider:       github");
		expect(result.content[0].text).toContain(
			"existingPr:     #12 (open) https://github.com/owner/repo/pull/12",
		);
	});

	it("falls back safely when no origin remote is configured", async () => {
		const exec = execFrom((cmd, args) => {
			const key = `${cmd} ${args.join(" ")}`;
			switch (key) {
				case "git remote get-url origin":
					return { stderr: "No such remote", code: 2 };
				case "git branch --show-current":
					return { stdout: "" };
				case "git symbolic-ref --short refs/remotes/origin/HEAD":
				case "git remote show origin":
					return { code: 1 };
				case "git show-ref --verify refs/heads/main":
					return { stdout: "abc refs/heads/main\n" };
				case "git worktree list --porcelain":
				case "git rev-parse --show-toplevel":
					return { code: 1 };
				case "git status --porcelain":
					return { stdout: " M README.md\n" };
				default:
					return { stderr: `unexpected command: ${key}`, code: 1 };
			}
		});

		const result = await executeGitContext(exec);

		expect(result.details).toEqual({
			provider: "unknown",
			defaultBranch: "main",
			currentBranch: "",
			mode: "branch",
			isClean: false,
			hasRemote: false,
			existingPr: null,
			warnings: [],
		});
		expect(result.content[0].text).toContain("currentBranch:  (detached)");
		expect(result.content[0].text).toContain("hasRemote:      false");
	});

	it("detects linked worktree mode", async () => {
		const exec = execFrom((cmd, args) => {
			const key = `${cmd} ${args.join(" ")}`;
			switch (key) {
				case "git remote get-url origin":
					return { stdout: "https://gitlab.com/owner/repo.git\n" };
				case "git branch --show-current":
					return { stdout: "feat/worktree\n" };
				case "git symbolic-ref --short refs/remotes/origin/HEAD":
					return { stdout: "origin/main\n" };
				case "git worktree list --porcelain":
					return {
						stdout: [
							"worktree /repo/main",
							"HEAD abc",
							"branch refs/heads/main",
							"",
							"worktree /repo/repo-feat-worktree",
							"HEAD def",
							"branch refs/heads/feat/worktree",
						].join("\n"),
					};
				case "git rev-parse --show-toplevel":
					return { stdout: "/repo/repo-feat-worktree\n" };
				case "git status --porcelain":
					return { stdout: "" };
				case "glab mr list --source-branch feat/worktree --all --output json":
					return { stdout: "[]" };
				default:
					return { stderr: `unexpected command: ${key}`, code: 1 };
			}
		});

		const result = await executeGitContext(exec);

		expect(result.details.provider).toBe("gitlab");
		expect(result.details.mode).toBe("worktree");
		expect(result.details.existingPr).toBeNull();
	});

	it("surfaces PR detection soft failures as warnings", async () => {
		const exec = execFrom((cmd, args) => {
			const key = `${cmd} ${args.join(" ")}`;
			switch (key) {
				case "git remote get-url origin":
					return { stdout: "git@github.com:owner/repo.git\n" };
				case "git branch --show-current":
					return { stdout: "feat/foo\n" };
				case "git symbolic-ref --short refs/remotes/origin/HEAD":
					return { stdout: "origin/main\n" };
				case "git worktree list --porcelain":
					return { stdout: "worktree /repo/main\nHEAD abc\nbranch refs/heads/feat/foo\n" };
				case "git rev-parse --show-toplevel":
					return { stdout: "/repo/main\n" };
				case "git status --porcelain":
					return { stdout: "" };
				case "gh pr list --head feat/foo --state all --json number,url,state --limit 1":
					return { stderr: "not authenticated", code: 1 };
				default:
					return { stderr: `unexpected command: ${key}`, code: 1 };
			}
		});

		const result = await executeGitContext(exec);

		expect(result.details.existingPr).toBeNull();
		expect(result.details.warnings).toEqual(["gh CLI unavailable or unauthenticated; existingPr left as null"]);
		expect(result.content[0].text).toContain("warnings:");
		expect(result.content[0].text).toContain("gh CLI unavailable or unauthenticated");
	});
});
