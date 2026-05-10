import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
	buildCreatePrArgs,
	createPr,
	detectProvider,
	findExistingPr,
	tryExec,
	withBodyFile,
	type ExecRunner,
} from "../pi-extensions/_shared/git-internals.ts";

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
				stdout: JSON.stringify([{ number: 42, url: "https://github.com/o/r/pull/42", state: "MERGED" }]),
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
			expect(args).toEqual(["mr", "list", "--source-branch", "feat/foo", "--all", "--output", "json"]);
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

	it("buildCreatePrArgs uses --body-file for gh when a body file is provided", () => {
		expect(
			buildCreatePrArgs(
				"github",
				{ base: "main", head: "feat/foo", title: "feat: add foo", body: "body", draft: true },
				"/tmp/body.md",
			),
		).toEqual([
			"pr",
			"create",
			"--base",
			"main",
			"--head",
			"feat/foo",
			"--title",
			"feat: add foo",
			"--body-file",
			"/tmp/body.md",
			"--draft",
		]);
	});

	it("buildCreatePrArgs uses --description-file for glab when a body file is provided", () => {
		expect(
			buildCreatePrArgs(
				"gitlab",
				{ base: "main", head: "feat/foo", title: "feat: add foo", body: "body" },
				"/tmp/body.md",
			),
		).toEqual([
			"mr",
			"create",
			"--target-branch",
			"main",
			"--source-branch",
			"feat/foo",
			"--title",
			"feat: add foo",
			"--description-file",
			"/tmp/body.md",
			"--yes",
		]);
	});

	it("buildCreatePrArgs omits the body flag when no body file is provided", () => {
		const gh = buildCreatePrArgs("github", { base: "main", head: "feat/foo", title: "feat: add foo" }, null);
		expect(gh).not.toContain("--body-file");
		expect(gh).not.toContain("--body");

		const glab = buildCreatePrArgs("gitlab", { base: "main", head: "feat/foo", title: "feat: add foo" }, null);
		expect(glab).not.toContain("--description-file");
		expect(glab).not.toContain("--description");
	});

	it("withBodyFile writes content and cleans up afterwards", async () => {
		const seenPath = await withBodyFile("hello body", async (path) => {
			expect(path).not.toBeNull();
			const contents = await readFile(path as string, "utf8");
			expect(contents).toBe("hello body");
			return path as string;
		});
		await expect(readFile(seenPath, "utf8")).rejects.toThrow();
	});

	it("withBodyFile passes null for empty bodies and creates no file", async () => {
		let observed: string | null = "unset";
		await withBodyFile("", async (path) => {
			observed = path;
		});
		expect(observed).toBeNull();
	});

	it("createPr invokes gh with --body-file and parses the created PR URL", async () => {
		let observedBody: string | null = null;
		let observedArgs: string[] | null = null;
		const exec = execFrom((cmd, args) => {
			expect(cmd).toBe("gh");
			observedArgs = args;
			const flagIndex = args.indexOf("--body-file");
			expect(flagIndex).toBeGreaterThan(-1);
			const bodyFilePath = args[flagIndex + 1];
			expect(typeof bodyFilePath).toBe("string");
			return {
				stdout: "https://github.com/o/r/pull/123\n",
				__bodyFilePath: bodyFilePath,
			} as { stdout: string; __bodyFilePath?: string };
		});

		// Wrap exec to read the body file before the temp dir is removed.
		const readingExec: ExecRunner = async (cmd, args, opts) => {
			const flagIndex = args.indexOf("--body-file");
			if (flagIndex !== -1) observedBody = await readFile(args[flagIndex + 1] as string, "utf8");
			return await exec(cmd, args, opts);
		};

		await expect(
			createPr(readingExec, "github", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
				body: "multi\nline body",
				draft: true,
			}),
		).resolves.toEqual({ ok: true, number: 123, url: "https://github.com/o/r/pull/123" });

		expect(observedBody).toBe("multi\nline body");
		expect(observedArgs).toContain("--draft");
	});

	it("createPr invokes glab with --description-file and parses the created MR URL", async () => {
		let observedBody: string | null = null;
		const exec = execFrom((cmd, args) => {
			expect(cmd).toBe("glab");
			const flagIndex = args.indexOf("--description-file");
			expect(flagIndex).toBeGreaterThan(-1);
			expect(typeof args[flagIndex + 1]).toBe("string");
			return { stderr: "Created merge request: https://gitlab.com/o/r/-/merge_requests/7\n" };
		});

		const readingExec: ExecRunner = async (cmd, args, opts) => {
			const flagIndex = args.indexOf("--description-file");
			if (flagIndex !== -1) observedBody = await readFile(args[flagIndex + 1] as string, "utf8");
			return await exec(cmd, args, opts);
		};

		await expect(
			createPr(readingExec, "gitlab", {
				base: "main",
				head: "feat/foo",
				title: "feat: add foo",
				body: "body content",
			}),
		).resolves.toEqual({ ok: true, number: 7, url: "https://gitlab.com/o/r/-/merge_requests/7" });

		expect(observedBody).toBe("body content");
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
