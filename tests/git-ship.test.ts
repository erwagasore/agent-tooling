import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gitShipExtension, { detectShipState } from "../pi-extensions/git-ship/index.ts";
import type { ExecRunner } from "../pi-extensions/_shared/git-internals.ts";
import { createMockPi } from "./helpers/pi-harness.ts";

type ShipContext = Parameters<typeof detectShipState>[0];

function ctx(overrides: Partial<ShipContext> = {}): ShipContext {
	return {
		provider: "github",
		defaultBranch: "main",
		currentBranch: "feat/foo",
		mode: "branch",
		isClean: true,
		hasRemote: true,
		existingPr: null,
		...overrides,
	};
}

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

function shipRepoExec(opts: {
	remoteUrl?: string | null;
	status?: string;
	currentBranch?: string;
	defaultBranch?: string;
	mode?: "branch" | "worktree";
	existingPr?: Array<{ number?: number; url?: string; state?: string }> | null;
	commits?: string;
	diffStat?: string;
	remoteHead?: string;
	pushOut?: string;
	createOut?: string;
	branchDeleteFails?: boolean;
} = {}, calls: string[][] = []): ExecRunner {
	const remoteUrl = opts.remoteUrl === undefined ? "git@github.com:owner/repo.git" : opts.remoteUrl;
	const status = opts.status ?? "";
	const currentBranch = opts.currentBranch ?? "feat/foo";
	const defaultBranch = opts.defaultBranch ?? "main";
	const mode = opts.mode ?? "branch";
	const existingPr = opts.existingPr ?? [];
	const commits = opts.commits ?? "abc123 feat: add foo";
	const diffStat = opts.diffStat ?? "file.txt | 1 +";

	return execFrom((cmd, args) => {
		calls.push([cmd, ...args]);
		const key = `${cmd} ${args.join(" ")}`;
		switch (key) {
			case "git remote get-url origin":
				return remoteUrl ? { stdout: `${remoteUrl}\n` } : { stderr: "No such remote", code: 2 };
			case "git status --porcelain":
				return { stdout: status };
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
			case `git diff --stat ${defaultBranch}..HEAD`:
				return { stdout: diffStat };
			case `git log --reverse --pretty=format:%h %s ${defaultBranch}..HEAD`:
				return { stdout: commits };
			case `git push -u origin ${currentBranch}`:
				return { stdout: opts.pushOut ?? `branch '${currentBranch}' set up\n` };
			case `git ls-remote --heads origin ${currentBranch}`:
				return { stdout: opts.remoteHead ?? "" };
			case `git checkout ${defaultBranch}`:
				return { stdout: `Switched to branch '${defaultBranch}'\n` };
			case `git branch -d ${currentBranch}`:
				return opts.branchDeleteFails
					? { stderr: "error: branch is not fully merged", code: 1 }
					: { stdout: `Deleted branch ${currentBranch}\n` };
			case `git branch -D ${currentBranch}`:
				return { stdout: `Deleted branch ${currentBranch} (was abc)\n` };
			case "git fetch origin --prune":
				return { stdout: "" };
			case `git pull origin ${defaultBranch}`:
				return { stdout: "Already up to date.\n" };
		}

		if (key.startsWith("gh pr list")) {
			return existingPr === null
				? { stderr: "not authenticated", code: 1 }
				: { stdout: JSON.stringify(existingPr) };
		}
		if (key.startsWith("gh pr create")) {
			return { stdout: opts.createOut ?? "https://github.com/owner/repo/pull/99\n" };
		}

		return { stderr: `unexpected command: ${key}`, code: 1 };
	});
}

function createShipContext(opts: {
	confirm?: boolean;
	input?: string;
	notifications?: Array<{ level: string; message: string }>;
} = {}) {
	const notifications = opts.notifications ?? [];
	return {
		cwd: process.cwd(),
		signal: undefined,
		hasUI: true,
		ui: {
			notify: (message: string, level: string) => notifications.push({ level, message }),
			confirm: async () => opts.confirm ?? false,
			input: async (_prompt: string, defaultValue?: string) => opts.input ?? defaultValue ?? "",
			setStatus: () => {},
			setWidget: () => {},
			setTitle: () => {},
			setEditorText: () => {},
		},
		sessionManager: { getEntries: () => [] },
	} as any;
}

async function runShip(exec: ExecRunner, args = "", ctx = createShipContext()) {
	const { pi, commands } = createMockPi(exec);
	gitShipExtension(pi);
	const command = commands.get("ship");
	expect(command).toBeDefined();
	await command!.handler(args, ctx);
	return ctx;
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	logSpy.mockRestore();
});

describe("git-ship state detection", () => {
	it("detects clean default branch as nothing to ship", () => {
		expect(
			detectShipState(ctx({ currentBranch: "main", defaultBranch: "main", isClean: true })),
		).toBe("default-clean");
	});

	it("detects dirty default branch as branch-needed state", () => {
		expect(
			detectShipState(ctx({ currentBranch: "main", defaultBranch: "main", isClean: false })),
		).toBe("default-dirty");
	});

	it("detects feature branch without PR as no-pr", () => {
		expect(detectShipState(ctx({ currentBranch: "feat/foo", existingPr: null }))).toBe("no-pr");
	});

	it("detects open, merged, and closed PR states", () => {
		expect(
			detectShipState(
				ctx({ existingPr: { number: 1, url: "https://example.com/pr/1", state: "open" } }),
			),
		).toBe("pr-open");
		expect(
			detectShipState(
				ctx({ existingPr: { number: 1, url: "https://example.com/pr/1", state: "merged" } }),
			),
		).toBe("pr-merged");
		expect(
			detectShipState(
				ctx({ existingPr: { number: 1, url: "https://example.com/pr/1", state: "closed" } }),
			),
		).toBe("pr-closed");
	});

	it("ignores worktree mode when selecting the high-level ship state", () => {
		expect(
			detectShipState(
				ctx({ mode: "worktree", existingPr: { number: 2, url: "https://example.com/pr/2", state: "merged" } }),
			),
		).toBe("pr-merged");
	});
});

describe("git-ship command phases", () => {
	it("prints status without mutating", async () => {
		const calls: string[][] = [];
		await runShip(shipRepoExec({ existingPr: [], currentBranch: "feat/foo" }, calls), "status");

		expect(logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")).toContain("State:           no-pr");
		expect(calls.some((c) => c.join(" ").startsWith("git push"))).toBe(false);
	});

	it("handles default-clean and default-dirty states", async () => {
		const cleanNotifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({ currentBranch: "main", defaultBranch: "main", status: "" }),
			"",
			createShipContext({ notifications: cleanNotifications }),
		);
		expect(cleanNotifications).toContainEqual({
			level: "info",
			message: "Nothing to ship. Use `/create-branch` to start work.",
		});

		const dirtyNotifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({ currentBranch: "main", defaultBranch: "main", status: " M file.txt\n" }),
			"",
			createShipContext({ notifications: dirtyNotifications }),
		);
		expect(dirtyNotifications).toContainEqual({
			level: "warning",
			message: "Dirty work on default branch. Run `/create-branch` then `/commit-changes`.",
		});
	});

	it("cancels no-pr before push when user declines", async () => {
		const calls: string[][] = [];
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({ existingPr: [], currentBranch: "feat/foo" }, calls),
			"",
			createShipContext({ confirm: false, notifications }),
		);

		expect(calls.some((c) => c.join(" ") === "git push -u origin feat/foo")).toBe(false);
		expect(notifications).toContainEqual({ level: "info", message: "Push cancelled." });
	});

	it("guards no-pr when the worktree is dirty", async () => {
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({ existingPr: [], currentBranch: "feat/foo", status: " M file.txt\n" }),
			"",
			createShipContext({ notifications }),
		);

		expect(notifications).toContainEqual({
			level: "warning",
			message: "Worktree has uncommitted changes. Commit or stash before shipping.",
		});
	});

	it("pushes and opens a PR in no-pr phase after confirmation", async () => {
		const calls: string[][] = [];
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({ existingPr: [], currentBranch: "feat/foo", createOut: "https://github.com/owner/repo/pull/99\n" }, calls),
			"",
			createShipContext({ confirm: true, input: "feat: add foo", notifications }),
		);

		expect(calls.some((c) => c.join(" ") === "git push -u origin feat/foo")).toBe(true);
		expect(calls.some((c) => c.join(" ").startsWith("gh pr create --base main --head feat/foo --title feat: add foo"))).toBe(true);
		expect(notifications).toContainEqual({
			level: "info",
			message: "PR #99 opened — https://github.com/owner/repo/pull/99",
		});
	});

	it("prints open PR state and waits for merge", async () => {
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({
				currentBranch: "feat/foo",
				existingPr: [{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "OPEN" }],
			}),
			"",
			createShipContext({ notifications }),
		);

		expect(notifications).toContainEqual({
			level: "info",
			message: "PR #12 open — https://github.com/owner/repo/pull/12",
		});
	});

	it("warns on closed PR state", async () => {
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec({
				currentBranch: "feat/foo",
				existingPr: [{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "CLOSED" }],
			}),
			"",
			createShipContext({ notifications }),
		);

		expect(notifications).toContainEqual({
			level: "warning",
			message: "PR was closed without merging. Investigate before re-shipping.",
		});
	});

	it("cleans up merged branch PRs and lands on default", async () => {
		const calls: string[][] = [];
		const notifications: Array<{ level: string; message: string }> = [];
		await runShip(
			shipRepoExec(
				{
					currentBranch: "feat/foo",
					existingPr: [{ number: 12, url: "https://github.com/owner/repo/pull/12", state: "MERGED" }],
					branchDeleteFails: true,
				},
				calls,
			),
			"",
			createShipContext({ confirm: true, notifications }),
		);

		expect(calls.map((c) => c.join(" "))).toEqual(
			expect.arrayContaining([
				"git ls-remote --heads origin feat/foo",
				"git checkout main",
				"git branch -d feat/foo",
				"git branch -D feat/foo",
				"git fetch origin --prune",
				"git pull origin main",
			]),
		);
		expect(notifications).toContainEqual({
			level: "info",
			message: "Landed on `main`. Local branch `feat/foo` cleaned up.",
		});
	});
});
