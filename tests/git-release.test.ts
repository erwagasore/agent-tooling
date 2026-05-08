import { describe, expect, it } from "vitest";
import gitReleaseExtension, {
	applyBump,
	buildChangelog,
	classifyCommit,
	computeBump,
	extractReleaseNotes,
	formatSemver,
	parseSemver,
} from "../pi-extensions/git-release/index.ts";
import { createMockPi } from "./helpers/pi-harness.ts";

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

	it("registers the /release command through the committed test harness", () => {
		const { pi, commands } = createMockPi();
		gitReleaseExtension(pi);

		expect(commands.has("release")).toBe(true);
		expect(commands.get("release")?.description).toContain("compute next semver");
	});
});
