import { describe, expect, it } from "vitest";
import {
	formatWorktreeTable,
	parseWorktreeList,
	sanitizeForPath,
} from "../pi-extensions/git-worktree/index.ts";

describe("git-worktree helpers", () => {
	it("sanitizes branch names for filesystem paths", () => {
		expect(sanitizeForPath("feat/foo")).toBe("feat-foo");
		expect(sanitizeForPath("wip/2026-05-08")).toBe("wip-2026-05-08");
		expect(sanitizeForPath("feat/foo bar+baz")).toBe("feat-foo-bar-baz");
		expect(sanitizeForPath("fix\\windows\\path")).toBe("fix-windows-path");
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
