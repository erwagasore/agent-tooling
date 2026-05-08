import { describe, expect, it } from "vitest";
import {
	createPr,
	detectProvider,
	findExistingPr,
	tryExec,
	type ExecRunner,
} from "../pi-extensions/_shared/git-internals.ts";

function execFrom(handler: (cmd: string, args: string[]) => { stdout?: string; stderr?: string; code?: number; killed?: boolean }): ExecRunner {
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

describe("git internals", () => {
	it("detects supported providers from origin URLs", () => {
		expect(detectProvider("git@github.com:owner/repo.git")).toBe("github");
		expect(detectProvider("https://gitlab.com/owner/repo.git")).toBe("gitlab");
		expect(detectProvider("ssh://git@gitlab.example.com/owner/repo.git")).toBe("gitlab");
		expect(detectProvider("https://bitbucket.org/owner/repo.git")).toBe("bitbucket");
		expect(detectProvider(null)).toBe("unknown");
		expect(detectProvider("https://example.com/owner/repo.git")).toBe("unknown");
	});

	it("tryExec trims stdout and returns null on failed commands", async () => {
		const ok = execFrom(() => ({ stdout: "  value\n" }));
		const failed = execFrom(() => ({ stderr: "boom", code: 1 }));
		const killed = execFrom(() => ({ stdout: "partial", killed: true }));

		await expect(tryExec(ok, "git", ["status"])).resolves.toBe("value");
		await expect(tryExec(failed, "git", ["status"])).resolves.toBeNull();
		await expect(tryExec(killed, "git", ["status"])).resolves.toBeNull();
	});

	it("findExistingPr parses GitHub PR JSON and normalizes state", async () => {
		const exec = execFrom((cmd, args) => {
			expect(cmd).toBe("gh");
			expect(args).toEqual([
				"pr",
				"list",
				"--head",
				"feat/foo",
				"--state",
				"all",
				"--json",
				"number,url,state",
				"--limit",
				"1",
			]);
			return {
				stdout: JSON.stringify([
					{ number: 42, url: "https://github.com/o/r/pull/42", state: "MERGED" },
				]),
			};
		});

		await expect(findExistingPr(exec, "github", "feat/foo")).resolves.toEqual({
			number: 42,
			url: "https://github.com/o/r/pull/42",
			state: "merged",
		});
	});

	it("findExistingPr parses GitLab MR JSON and normalizes state", async () => {
		const exec = execFrom((cmd, args) => {
			expect(cmd).toBe("glab");
			expect(args).toEqual([
				"mr",
				"list",
				"--source-branch",
				"feat/foo",
				"--all",
				"--output",
				"json",
			]);
			return {
				stdout: JSON.stringify([
					{ iid: 7, web_url: "https://gitlab.com/o/r/-/merge_requests/7", state: "closed" },
				]),
			};
		});

		await expect(findExistingPr(exec, "gitlab", "feat/foo")).resolves.toEqual({
			number: 7,
			url: "https://gitlab.com/o/r/-/merge_requests/7",
			state: "closed",
		});
	});

	it("findExistingPr reports unsupported providers as warnings", async () => {
		const warnings: string[] = [];
		const exec = execFrom(() => {
			throw new Error("should not execute");
		});

		await expect(findExistingPr(exec, "bitbucket", "feat/foo", undefined, warnings)).resolves.toBeNull();
		expect(warnings).toEqual(["Provider bitbucket not supported for PR detection"]);
	});

	it("createPr invokes gh and parses the created PR URL", async () => {
		let called = false;
		const exec = execFrom((cmd, args) => {
			called = true;
			expect(cmd).toBe("gh");
			expect(args).toEqual([
				"pr",
				"create",
				"--base",
				"main",
				"--head",
				"feat/foo",
				"--title",
				"feat: add foo",
				"--body",
				"body",
				"--draft",
			]);
			return { stdout: "https://github.com/o/r/pull/123\n" };
		});

		await expect(
			createPr(exec, "github", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
				body: "body",
				draft: true,
			}),
		).resolves.toEqual({ ok: true, number: 123, url: "https://github.com/o/r/pull/123" });
		expect(called).toBe(true);
	});

	it("createPr invokes glab and parses the created MR URL", async () => {
		const exec = execFrom((cmd, args) => {
			expect(cmd).toBe("glab");
			expect(args).toEqual([
				"mr",
				"create",
				"--target-branch",
				"main",
				"--source-branch",
				"feat/foo",
				"--title",
				"feat: add foo",
				"--description",
				"body",
				"--yes",
			]);
			return { stderr: "Created merge request: https://gitlab.com/o/r/-/merge_requests/7\n" };
		});

		await expect(
			createPr(exec, "gitlab", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
				body: "body",
			}),
		).resolves.toEqual({ ok: true, number: 7, url: "https://gitlab.com/o/r/-/merge_requests/7" });
	});

	it("createPr surfaces unsupported providers and CLI failures", async () => {
		const exec = execFrom(() => ({ stderr: "not authenticated", code: 1 }));

		await expect(
			createPr(exec, "bitbucket", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
			}),
		).resolves.toEqual({ ok: false, error: "Provider bitbucket is not supported for PR creation" });

		await expect(
			createPr(exec, "github", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
			}),
		).resolves.toEqual({ ok: false, error: "not authenticated" });
	});
});
