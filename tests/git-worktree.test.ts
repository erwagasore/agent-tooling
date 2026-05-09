import { describe, expect, it } from "vitest";
import type { ExecRunner } from "../pi-extensions/_shared/git-internals.ts";
import {
	fetchOriginPrune,
	formatWorktreeTable,
	getMainRepoPath,
	isWorktreeClean,
	mainPathFromWorktreeList,
	parseWorktreeList,
	sanitizeForPath,
	validateBranchName,
} from "../pi-extensions/git-worktree/index.ts";

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

describe("git-worktree helpers", () => {
	it("sanitizes branch names for filesystem paths", () => {
		expect(sanitizeForPath("feat/foo")).toBe("feat-foo");
		expect(sanitizeForPath("wip/2026-05-08")).toBe("wip-2026-05-08");
		expect(sanitizeForPath("feat/foo bar+baz")).toBe("feat-foo-bar-baz");
		expect(sanitizeForPath("fix\\windows\\path")).toBe("fix-windows-path");
	});

	it("extracts the main repo path from git worktree porcelain output", () => {
		expect(
			mainPathFromWorktreeList(
				[
					"worktree /repo/main",
					"HEAD abcdef1234567890",
					"branch refs/heads/main",
					"",
					"worktree /repo/feature",
				].join("\n"),
			),
		).toBe("/repo/main");
		expect(mainPathFromWorktreeList("garbage")).toBeNull();
	});

	it("resolves main repo path from worktree list before falling back", async () => {
		const exec = execFrom((cmd, args) => {
			if (cmd === "git" && args.join(" ") === "worktree list --porcelain") {
				return { stdout: "worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n" };
			}
			throw new Error("unexpected fallback call");
		});

		await expect(getMainRepoPath(exec)).resolves.toBe("/repo/main");
	});

	it("validates branch names with git check-ref-format", async () => {
		const calls: string[][] = [];
		const exec = execFrom((cmd, args) => {
			calls.push([cmd, ...args]);
			return { stdout: "feat/foo\n" };
		});

		await expect(validateBranchName(exec, "feat/foo")).resolves.toEqual({ ok: true });
		expect(calls).toEqual([["git", "check-ref-format", "--branch", "feat/foo"]]);
	});

	it("rejects invalid branch names before mutation", async () => {
		const exec = execFrom(() => ({ stderr: "fatal: invalid refname", code: 1 }));

		await expect(validateBranchName(exec, "feat/foo bar")).resolves.toEqual({
			ok: false,
			reason: "branch name cannot contain whitespace",
		});
		await expect(validateBranchName(exec, " bad")).resolves.toEqual({
			ok: false,
			reason: "branch name has leading or trailing whitespace",
		});
		await expect(validateBranchName(exec, "feat//bad")).resolves.toEqual({
			ok: false,
			reason: "fatal: invalid refname",
		});
	});

	it("fetches and prunes origin before creating a worktree", async () => {
		const calls: string[][] = [];
		const exec = execFrom((cmd, args) => {
			calls.push([cmd, ...args]);
			return { stdout: "" };
		});

		await expect(fetchOriginPrune(exec, "/repo/main")).resolves.toEqual({ ok: true, out: "" });
		expect(calls).toEqual([["git", "-C", "/repo/main", "fetch", "origin", "--prune"]]);
	});

	it("checks worktree cleanliness before land/remove", async () => {
		await expect(isWorktreeClean(execFrom(() => ({ stdout: "" })))).resolves.toBe(true);
		await expect(isWorktreeClean(execFrom(() => ({ stdout: " M file.txt\n" })))).resolves.toBe(false);
		await expect(isWorktreeClean(execFrom(() => ({ stderr: "not a repo", code: 128 })))).resolves.toBeNull();
	});

	it("parses git worktree porcelain output", () => {
		const out = [
			"worktree /repo/main",
			"HEAD abcdef1234567890",
			"branch refs/heads/main",
			"",
			"worktree /repo/agent-tooling-feat-foo",
			"HEAD 1234567890abcdef",
			"branch refs/heads/feat/foo",
			"",
			"worktree /repo/detached",
			"HEAD fedcba9876543210",
			"detached",
			"",
			"worktree /repo/bare",
			"HEAD 0000000000000000",
			"bare",
		].join("\n");

		expect(parseWorktreeList(out)).toEqual([
			{
				path: "/repo/main",
				head: "abcdef1234567890",
				branch: "main",
				bare: false,
				detached: false,
			},
			{
				path: "/repo/agent-tooling-feat-foo",
				head: "1234567890abcdef",
				branch: "feat/foo",
				bare: false,
				detached: false,
			},
			{
				path: "/repo/detached",
				head: "fedcba9876543210",
				branch: null,
				bare: false,
				detached: true,
			},
			{
				path: "/repo/bare",
				head: "0000000000000000",
				branch: null,
				bare: true,
				detached: false,
			},
		]);
	});

	it("formats worktree entries as a friendly table", () => {
		const table = formatWorktreeTable([
			{
				path: "/repo/main",
				head: "abcdef1234567890",
				branch: "main",
				bare: false,
				detached: false,
			},
			{
				path: "/repo/detached",
				head: "fedcba9876543210",
				branch: null,
				bare: false,
				detached: true,
			},
			{
				path: "/repo/bare",
				head: "0000000000000000",
				branch: null,
				bare: true,
				detached: false,
			},
		]);

		expect(table).toContain("PATH");
		expect(table).toContain("BRANCH");
		expect(table).toContain("HEAD");
		expect(table).toContain("/repo/main");
		expect(table).toContain("main");
		expect(table).toContain("(detached @ fedcba9)");
		expect(table).toContain("(bare)");
	});

	it("formats an empty worktree list", () => {
		expect(formatWorktreeTable([])).toBe("(no worktrees)");
	});
});
