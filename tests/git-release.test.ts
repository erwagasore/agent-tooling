import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import gitReleaseExtension, {
	applyBump,
	buildChangelog,
	bumpManifests,
	checkProviderAuth,
	classifyCommit,
	computeBump,
	extractReleaseNotes,
	formatManifestBumpSummary,
	formatRecoverySteps,
	formatSemver,
	parseSemver,
	preflightReleaseSafety,
	detectProjectProfile,
	stageReleaseFiles,
	tagExists,
} from "../pi-extensions/git-release/index.ts";
import type { ExecRunner } from "../pi-extensions/_shared/git-internals.ts";
import { createMockPi } from "./helpers/pi-harness.ts";

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

describe("git-release helpers", () => {
	it("parses, formats, and bumps semver", () => {
		expect(parseSemver("v0.8.0")).toEqual({ major: 0, minor: 8, patch: 0 });
		expect(parseSemver("1.2.3-rc.1")).toEqual({ major: 1, minor: 2, patch: 3 });
		expect(parseSemver("not-a-version")).toBeNull();
		expect(formatSemver(applyBump({ major: 0, minor: 8, patch: 0 }, "minor"))).toBe("0.9.0");
	});

	it("requires BREAKING CHANGE markers to start their own body line", () => {
		const realFooter = classifyCommit(
			"a1\x00feat: add new API\x00Details.\n\nBREAKING CHANGE: remove old API",
		);
		const midLineMention = classifyCommit(
			"a2\x00feat: document release rules\x00- `feat!` and `BREAKING CHANGE:`-in-body both trigger major.",
		);
		const hyphenatedFooter = classifyCommit(
			"a3\x00feat: add new API\x00BREAKING-CHANGE: remove old API",
		);
		const markdownTableMention = classifyCommit(
			"a4\x00feat: document release rules\x00| `feat!:` or `BREAKING CHANGE` in body | major |",
		);

		expect(realFooter.breaking).toBe(true);
		expect(hyphenatedFooter.breaking).toBe(true);
		expect(midLineMention.breaking).toBe(false);
		expect(markdownTableMention.breaking).toBe(false);
	});

	it("computes bump from classified commits", () => {
		const commits = [
			classifyCommit("f1\x00fix: patch bug\x00"),
			classifyCommit("f2\x00feat: add feature\x00"),
		];
		expect(computeBump(commits)).toBe("minor");
		expect(computeBump([classifyCommit("d1\x00docs: update readme\x00")])).toBe("none");
		expect(computeBump([classifyCommit("b1\x00feat!: break API\x00")])).toBe("major");
	});

	it("renders grouped changelog sections and skips release commits", () => {
		const changelog = buildChangelog(
			[
				classifyCommit("f1\x00feat: add git-pr extension\x00"),
				classifyCommit("x1\x00fix: tighten classifier\x00"),
				classifyCommit("d1\x00docs: promote cycle\x00"),
				classifyCommit("c1\x00chore: release v0.9.0\x00"),
			],
			{ major: 0, minor: 9, patch: 0 },
			"2026-05-08",
		);

		expect(changelog).toContain("## [0.9.0] — 2026-05-08");
		expect(changelog).toContain("### Features");
		expect(changelog).toContain("- Add git-pr extension");
		expect(changelog).toContain("### Fixes");
		expect(changelog).toContain("- Tighten classifier");
		expect(changelog).toContain("### Other");
		expect(changelog).not.toContain("Release v0.9.0");
	});

	it("extracts provider release notes by removing only the version header", () => {
		const section = "## [0.9.0] — 2026-05-08\n\n### Features\n\n- Add git-pr extension";

		expect(extractReleaseNotes(section)).toBe("### Features\n\n- Add git-pr extension");
	});

	it("stages CHANGELOG.md explicitly so new changelogs are committed", async () => {
		const calls: string[][] = [];
		const exec = execFrom((cmd, args) => {
			calls.push([cmd, ...args]);
			return { stdout: "" };
		});

		await expect(stageReleaseFiles(exec, [])).resolves.toEqual({
			ok: true,
			out: "",
			files: ["CHANGELOG.md"],
		});
		expect(calls).toEqual([["git", "add", "--", "CHANGELOG.md"]]);
	});

	it("stages all bumped manifests", async () => {
		const calls: string[][] = [];
		const exec = execFrom((cmd, args) => {
			calls.push([cmd, ...args]);
			return { stdout: "" };
		});

		await expect(stageReleaseFiles(exec, ["package.json", "Cargo.toml", "pyproject.toml"])).resolves.toEqual({
			ok: true,
			out: "",
			files: ["CHANGELOG.md", "package.json", "Cargo.toml", "pyproject.toml"],
		});
		expect(calls).toEqual([["git", "add", "--", "CHANGELOG.md", "package.json", "Cargo.toml", "pyproject.toml"]]);
	});

	it("detects and bumps manifests by language ecosystem", async () => {
		const repo = await mkdtemp(join(tmpdir(), "agent-tooling-release-"));
		await writeFile(join(repo, "package.json"), JSON.stringify({ name: "demo", version: "0.1.0" }, null, 2) + "\n");
		await writeFile(join(repo, "Cargo.toml"), "[package]\nname = \"demo\"\nversion = \"0.1.0\"\n");
		await writeFile(join(repo, "pyproject.toml"), "[project]\nname = \"demo\"\nversion = \"0.1.0\"\n");
		await writeFile(join(repo, "build.zig.zon"), ".{\n    .name = .demo,\n    .version = \"0.1.0\",\n}\n");
		await writeFile(join(repo, "mix.exs"), "def project do\n  [app: :demo, version: \"0.1.0\", elixir: \"~> 1.16\"]\nend\n");

		const results = await bumpManifests(repo, { major: 0, minor: 2, patch: 0 });

		expect(results).toEqual([
			{ language: "JavaScript/TypeScript", name: "package.json", path: "package.json", versionBefore: "0.1.0", updated: true, reason: undefined },
			{ language: "Rust", name: "Cargo.toml", path: "Cargo.toml", versionBefore: "0.1.0", updated: true, reason: undefined },
			{ language: "Python", name: "pyproject.toml", path: "pyproject.toml", versionBefore: "0.1.0", updated: true, reason: undefined },
			{ language: "Zig", name: "build.zig.zon", path: "build.zig.zon", versionBefore: "0.1.0", updated: true, reason: undefined },
			{ language: "Elixir", name: "mix.exs", path: "mix.exs", versionBefore: "0.1.0", updated: true, reason: undefined },
		]);
		expect(JSON.parse(await readFile(join(repo, "package.json"), "utf8"))).toMatchObject({ version: "0.2.0" });
		expect(await readFile(join(repo, "Cargo.toml"), "utf8")).toContain("version = \"0.2.0\"");
		expect(await readFile(join(repo, "pyproject.toml"), "utf8")).toContain("version = \"0.2.0\"");
		expect(await readFile(join(repo, "build.zig.zon"), "utf8")).toContain(".version = \"0.2.0\"");
		expect(await readFile(join(repo, "mix.exs"), "utf8")).toContain("version: \"0.2.0\"");
	});

	it("detects project ecosystems from root marker files", async () => {
		const repo = await mkdtemp(join(tmpdir(), "agent-tooling-release-"));
		await writeFile(join(repo, "mix.exs"), "def project, do: [version: \"0.1.0\"]\n");
		await writeFile(join(repo, "go.mod"), "module example.com/demo\n");
		await writeFile(join(repo, "demo.gemspec"), "Gem::Specification.new do |s|\nend\n");

		await expect(detectProjectProfile(repo)).resolves.toEqual({
			root: repo,
			ecosystems: ["Elixir", "Go", "Ruby"],
			files: ["demo.gemspec", "go.mod", "mix.exs"],
		});
	});

	it("skips generic fallback files when version fields are ambiguous", async () => {
		const repo = await mkdtemp(join(tmpdir(), "agent-tooling-release-"));
		await writeFile(
			join(repo, "custom.toml"),
			"version = \"0.1.0\"\n[dependency]\nversion = \"9.9.9\"\n",
		);

		await expect(bumpManifests(repo, { major: 0, minor: 2, patch: 0 })).resolves.toEqual([]);
		expect(await readFile(join(repo, "custom.toml"), "utf8")).toContain("version = \"0.1.0\"");
		expect(await readFile(join(repo, "custom.toml"), "utf8")).toContain("version = \"9.9.9\"");
	});

	it("reports detected manifests without writable versions", async () => {
		const repo = await mkdtemp(join(tmpdir(), "agent-tooling-release-"));
		await writeFile(join(repo, "package.json"), JSON.stringify({ name: "demo" }, null, 2) + "\n");
		await writeFile(join(repo, "pyproject.toml"), "[project]\nname = \"demo\"\ndynamic = [\"version\"]\n");

		const results = await bumpManifests(repo, { major: 1, minor: 0, patch: 0 });

		expect(results).toEqual([
			{
				language: "JavaScript/TypeScript",
				name: "package.json",
				path: "package.json",
				versionBefore: null,
				updated: false,
				reason: "no writable version field found",
			},
			{
				language: "Python",
				name: "pyproject.toml",
				path: "pyproject.toml",
				versionBefore: null,
				updated: false,
				reason: "no writable version field found",
			},
		]);
	});

	it("formats manifest bump summaries", () => {
		expect(formatManifestBumpSummary([], { major: 1, minor: 2, patch: 3 })).toEqual([
			"No supported manifests found; skipping manifest bump.",
		]);
		expect(
			formatManifestBumpSummary(
				[
					{ language: "JavaScript/TypeScript", name: "package.json", path: "package.json", versionBefore: "1.0.0", updated: true },
					{
						language: "Python",
						name: "pyproject.toml",
						path: "pyproject.toml",
						versionBefore: null,
						updated: false,
						reason: "no writable version field found",
					},
				],
				{ major: 1, minor: 2, patch: 3 },
			),
		).toEqual([
			"Bumped JavaScript/TypeScript manifest package.json 1.0.0 → 1.2.3",
			"Skipped Python manifest pyproject.toml: no writable version field found.",
		]);
	});

	it("detects local and remote tag collisions before mutation", async () => {
		const exec = execFrom((cmd, args) => {
			if (cmd === "git" && args[0] === "show-ref") return { stdout: "abc refs/tags/v0.9.0\n" };
			if (cmd === "git" && args[0] === "ls-remote") return { stdout: "def\trefs/tags/v0.9.0\n" };
			return { code: 1 };
		});

		await expect(tagExists(exec, "v0.9.0")).resolves.toEqual({
			local: true,
			remote: true,
			remoteCheckOk: true,
		});
	});

	it("checks provider auth with gh/glab and ignores unsupported providers", async () => {
		const ghOk = execFrom((cmd, args) => {
			expect([cmd, ...args]).toEqual(["gh", "auth", "status"]);
			return { stdout: "Logged in" };
		});
		const glabFail = execFrom((cmd, args) => {
			expect([cmd, ...args]).toEqual(["glab", "auth", "status"]);
			return { stderr: "not authenticated", code: 1 };
		});

		await expect(checkProviderAuth(ghOk, "github")).resolves.toEqual({ ok: true });
		await expect(checkProviderAuth(glabFail, "gitlab")).resolves.toEqual({
			ok: false,
			message: "not authenticated",
		});
		await expect(checkProviderAuth(ghOk, "bitbucket")).resolves.toEqual({ ok: true });
	});

	it("fails release safety when remote tag lookup cannot be checked", async () => {
		const exec = execFrom((cmd, args) => {
			if (cmd === "git" && args[0] === "show-ref") return { code: 1 };
			if (cmd === "git" && args[0] === "ls-remote") return { stderr: "network unavailable", code: 128 };
			if (cmd === "gh" && args[0] === "auth") return { stdout: "Logged in" };
			return { code: 1 };
		});

		const safety = await preflightReleaseSafety(exec, "v0.9.0", "github", true);

		expect(safety.ok).toBe(false);
		expect(safety.failures).toContain("Could not check whether tag v0.9.0 already exists on origin.");
	});

	it("preflights release safety before any mutation", async () => {
		const exec = execFrom((cmd, args) => {
			if (cmd === "git" && args[0] === "show-ref") return { stdout: "abc refs/tags/v0.9.0\n" };
			if (cmd === "git" && args[0] === "ls-remote") return { stdout: "def\trefs/tags/v0.9.0\n" };
			if (cmd === "gh" && args[0] === "auth") return { stderr: "not authenticated", code: 1 };
			return { code: 1 };
		});

		const safety = await preflightReleaseSafety(exec, "v0.9.0", "github", false);

		expect(safety.ok).toBe(false);
		expect(safety.failures).toContain("No `origin` remote is configured; release cannot push tags or publish host notes.");
		expect(safety.failures).toContain("Local tag v0.9.0 already exists.");
		expect(safety.failures).toContain("Remote tag v0.9.0 already exists on origin.");
		expect(safety.failures).toContain("Provider auth check failed for github: not authenticated");
	});

	it("warns instead of failing when provider release publishing is unsupported", async () => {
		const exec = execFrom((cmd, args) => {
			if (cmd === "git" && args[0] === "show-ref") return { code: 1 };
			if (cmd === "git" && args[0] === "ls-remote") return { stdout: "" };
			throw new Error("unexpected command");
		});

		const safety = await preflightReleaseSafety(exec, "v0.9.0", "bitbucket", true);

		expect(safety.ok).toBe(true);
		expect(safety.failures).toEqual([]);
		expect(safety.warnings).toEqual([
			"Provider `bitbucket` does not support automated release publishing; /release will push the tag but skip host release notes.",
		]);
	});

	it("formats recovery instructions for partial release failures", () => {
		expect(formatRecoverySteps("v0.9.0", "main", "commit")).toContain("Inspect with `git status`");
		expect(formatRecoverySteps("v0.9.0", "main", "tag")).toContain("git tag -a v0.9.0 -m v0.9.0");
		expect(formatRecoverySteps("v0.9.0", "main", "push")).toContain("git push origin main --follow-tags");
		expect(formatRecoverySteps("v0.9.0", "main", "provider-release")).toContain("host release notes were not published");
	});

	it("registers the /release command through the committed test harness", () => {
		const { pi, commands } = createMockPi();
		gitReleaseExtension(pi);

		expect(commands.has("release")).toBe(true);
		expect(commands.get("release")?.description).toContain("compute next semver");
	});
});
