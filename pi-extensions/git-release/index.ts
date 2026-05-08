/**
 * git-release — version, changelog, tag, and provider release in one command.
 *
 * `/release status`  → read latest tag, walk commits, classify CC types,
 *                       print bump + next version + draft changelog. Pure dry-run.
 * `/release [patch|minor|major]`
 *                    → confirm, bump manifest, prepend CHANGELOG.md, commit
 *                       `chore: release vX.Y.Z`, tag annotated, push --follow-tags,
 *                       create provider release via gh/glab.
 *
 * Replaces the prose state machine inside the `create-release` skill. SPEC §
 * Extensions / git-release.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import {
	detectDefaultBranch,
	detectProvider,
	type ExecRunner,
	type Provider,
	tryExec,
} from "../_shared/git-internals.ts";

// ── Types ────────────────────────────────────────────────────

type Bump = "patch" | "minor" | "major" | "none";

interface Semver {
	major: number;
	minor: number;
	patch: number;
}

interface CommitInfo {
	hash: string;
	subject: string;
	body: string;
	type: string;
	scope?: string;
	breaking: boolean;
	description: string;
}

interface ReleasePlan {
	currentVersion: Semver;
	currentTag: string | null; // last release tag, e.g. "v0.8.0"
	bump: Bump;
	bumpReason: "computed" | "override" | "no-bump-worthy";
	nextVersion: Semver;
	commits: CommitInfo[];
	changelog: string;
	date: string;
}

// ── Semver helpers ───────────────────────────────────────────

function parseSemver(s: string): Semver | null {
	const m = s.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-.+)?$/);
	if (!m) return null;
	return {
		major: parseInt(m[1] ?? "0", 10),
		minor: parseInt(m[2] ?? "0", 10),
		patch: parseInt(m[3] ?? "0", 10),
	};
}

function formatSemver(v: Semver): string {
	return `${v.major}.${v.minor}.${v.patch}`;
}

function applyBump(v: Semver, bump: Bump): Semver {
	if (bump === "major") return { major: v.major + 1, minor: 0, patch: 0 };
	if (bump === "minor") return { major: v.major, minor: v.minor + 1, patch: 0 };
	if (bump === "patch") return { major: v.major, minor: v.minor, patch: v.patch + 1 };
	return v;
}

// ── Commit classification ────────────────────────────────────

const COMMIT_RE = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

// Per Conventional Commits, a BREAKING CHANGE marker is a footer token that
// MUST start its own line. The previous regex matched anywhere in the body,
// which incorrectly classified PR descriptions that *mention* the spec
// (e.g. "`BREAKING CHANGE:`-in-body triggers major") as breaking changes.
// The multiline `^` anchor restricts the match to a line start.
const BREAKING_FOOTER_RE = /^BREAKING[- ]CHANGE:/m;

function classifyCommit(record: string): CommitInfo {
	const [hash = "", subject = "", body = ""] = record.split("\x00");
	const m = subject.match(COMMIT_RE);
	if (m) {
		const [, type = "other", scope, bang, description = subject] = m;
		const breaking = !!bang || BREAKING_FOOTER_RE.test(body);
		return { hash, subject, body, type, scope, breaking, description };
	}
	return { hash, subject, body, type: "other", breaking: false, description: subject };
}

function computeBump(commits: CommitInfo[]): Bump {
	let bump: Bump = "none";
	for (const c of commits) {
		if (c.breaking) return "major";
		if (c.type === "feat") {
			if (bump === "none" || bump === "patch") bump = "minor";
		} else if (c.type === "fix") {
			if (bump === "none") bump = "patch";
		}
	}
	return bump;
}

// ── Changelog rendering ──────────────────────────────────────

function capitalize(s: string): string {
	return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildChangelog(commits: CommitInfo[], version: Semver, date: string): string {
	const breaking: string[] = [];
	const features: string[] = [];
	const fixes: string[] = [];
	const other: string[] = [];

	for (const c of commits) {
		// Skip release commits themselves
		if (c.type === "chore" && /^release\s+v?\d/i.test(c.description)) continue;

		const bullet = `- ${capitalize(c.description)}`;
		if (c.breaking) breaking.push(bullet);
		else if (c.type === "feat") features.push(bullet);
		else if (c.type === "fix") fixes.push(bullet);
		else other.push(bullet);
	}

	const parts = [`## [${formatSemver(version)}] — ${date}`];
	if (breaking.length) parts.push("", "### Breaking Changes", "", ...breaking);
	if (features.length) parts.push("", "### Features", "", ...features);
	if (fixes.length) parts.push("", "### Fixes", "", ...fixes);
	if (other.length) parts.push("", "### Other", "", ...other);
	return parts.join("\n");
}

// ── Plan reading ─────────────────────────────────────────────

async function readReleasePlan(
	exec: ExecRunner,
	override: Bump | undefined,
	signal?: AbortSignal,
): Promise<ReleasePlan> {
	const tagsOut = await tryExec(
		exec,
		"git",
		["tag", "--list", "v*", "--sort=-version:refname"],
		signal,
	);
	const latestTag = tagsOut?.split("\n")[0]?.trim() || null;
	const currentVersion = (latestTag && parseSemver(latestTag)) || {
		major: 0,
		minor: 0,
		patch: 0,
	};

	const range = latestTag ? `${latestTag}..HEAD` : "HEAD";
	const logOut = await tryExec(
		exec,
		"git",
		[
			"log",
			"--reverse",
			"--no-merges",
			`--pretty=format:%H%x00%s%x00%b%x1e`,
			range,
		],
		signal,
	);
	const records = (logOut ?? "").split("\x1e").map((r) => r.trim()).filter(Boolean);
	const commits = records.map(classifyCommit);

	const computed = computeBump(commits);
	let bump: Bump = override ?? computed;
	let bumpReason: ReleasePlan["bumpReason"] = override
		? "override"
		: computed === "none"
			? "no-bump-worthy"
			: "computed";
	if (bump === "none") bumpReason = "no-bump-worthy";

	const nextVersion = applyBump(currentVersion, bump);
	const date = new Date().toISOString().slice(0, 10);
	const changelog = buildChangelog(commits, nextVersion, date);

	return {
		currentVersion,
		currentTag: latestTag,
		bump,
		bumpReason,
		nextVersion,
		commits,
		changelog,
		date,
	};
}

// ── Plan formatting ──────────────────────────────────────────

function formatPlan(plan: ReleasePlan, mode: "status" | "execute"): string {
	const lines: string[] = [];
	lines.push("=== Release plan ===");
	lines.push(`Current:  ${plan.currentTag ?? "(no tags yet)"}  →  v${formatSemver(plan.nextVersion)}`);
	lines.push(`Bump:     ${plan.bump}  (${plan.bumpReason})`);
	lines.push(`Commits:  ${plan.commits.length}`);
	if (plan.commits.length) {
		const byType = new Map<string, number>();
		for (const c of plan.commits) {
			const k = c.breaking ? `${c.type}!` : c.type;
			byType.set(k, (byType.get(k) ?? 0) + 1);
		}
		const breakdown = Array.from(byType.entries())
			.map(([k, v]) => `${v}× ${k}`)
			.join(", ");
		lines.push(`          (${breakdown})`);
	}
	lines.push("");
	lines.push("=== Draft CHANGELOG section ===");
	lines.push(plan.changelog);
	lines.push("");
	if (mode === "status") {
		lines.push("(dry-run: no changes will be made; run `/release` without `status` to apply)");
	}
	return lines.join("\n");
}

// ── Execution helpers ────────────────────────────────────────

async function execLoud(
	exec: ExecRunner,
	cmd: string,
	args: string[],
	signal?: AbortSignal,
): Promise<{ ok: boolean; out: string }> {
	try {
		const r = await exec(cmd, args, { signal });
		const out = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
		return { ok: r.code === 0 && !r.killed, out };
	} catch (err) {
		return { ok: false, out: String((err as Error).message ?? err) };
	}
}

interface ReleaseSafetyCheck {
	ok: boolean;
	failures: string[];
	warnings: string[];
}

async function tagExists(
	exec: ExecRunner,
	tag: string,
	signal?: AbortSignal,
): Promise<{ local: boolean; remote: boolean; remoteCheckOk: boolean }> {
	const local =
		(await tryExec(exec, "git", ["show-ref", "--verify", `refs/tags/${tag}`], signal)) !== null;
	const remote = await execLoud(exec, "git", ["ls-remote", "--tags", "origin", tag], signal);
	return { local, remote: remote.ok && !!remote.out.trim(), remoteCheckOk: remote.ok };
}

async function checkProviderAuth(
	exec: ExecRunner,
	provider: Provider,
	signal?: AbortSignal,
): Promise<{ ok: boolean; message?: string }> {
	if (provider === "github") {
		const auth = await execLoud(exec, "gh", ["auth", "status"], signal);
		return auth.ok ? { ok: true } : { ok: false, message: auth.out || "gh auth status failed" };
	}
	if (provider === "gitlab") {
		const auth = await execLoud(exec, "glab", ["auth", "status"], signal);
		return auth.ok ? { ok: true } : { ok: false, message: auth.out || "glab auth status failed" };
	}
	return { ok: true };
}

async function preflightReleaseSafety(
	exec: ExecRunner,
	versionStr: string,
	provider: Provider,
	hasRemote: boolean,
	signal?: AbortSignal,
): Promise<ReleaseSafetyCheck> {
	const failures: string[] = [];
	const warnings: string[] = [];

	if (!hasRemote) {
		failures.push("No `origin` remote is configured; release cannot push tags or publish host notes.");
	}

	const tags = await tagExists(exec, versionStr, signal);
	if (tags.local) failures.push(`Local tag ${versionStr} already exists.`);
	if (tags.remote) failures.push(`Remote tag ${versionStr} already exists on origin.`);
	if (hasRemote && !tags.remoteCheckOk) {
		failures.push(`Could not check whether tag ${versionStr} already exists on origin.`);
	}

	const auth = await checkProviderAuth(exec, provider, signal);
	if (!auth.ok) {
		failures.push(
			`Provider auth check failed for ${provider}: ${auth.message ?? "unknown error"}`,
		);
	} else if (provider !== "github" && provider !== "gitlab") {
		warnings.push(
			`Provider \`${provider}\` does not support automated release publishing; /release will push the tag but skip host release notes.`,
		);
	}

	return { ok: failures.length === 0, failures, warnings };
}

function formatRecoverySteps(versionStr: string, defaultBranch: string, phase: "commit" | "tag" | "push" | "provider-release"): string {
	const pushCmd = `git push origin ${defaultBranch} --follow-tags`;
	if (phase === "commit") {
		return [
			"Recovery:",
			"  - Files may have been modified but no release commit/tag was created.",
			"  - Inspect with `git status` and `git diff`.",
			"  - Either commit manually or restore the files before retrying `/release`.",
		].join("\n");
	}
	if (phase === "tag") {
		return [
			"Recovery:",
			"  - A release commit may exist, but the tag was not created.",
			`  - Create the tag manually: git tag -a ${versionStr} -m ${versionStr}`,
			`  - Then push: ${pushCmd}`,
		].join("\n");
	}
	if (phase === "push") {
		return [
			"Recovery:",
			"  - Local release commit and tag exist, but were not pushed.",
			`  - Push manually: ${pushCmd}`,
		].join("\n");
	}
	return [
		"Recovery:",
		"  - The tag is pushed, but host release notes were not published.",
		`  - Create the provider release manually for ${versionStr} using the CHANGELOG section as notes.`,
	].join("\n");
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function bumpPackageJson(repoRoot: string, next: Semver): Promise<boolean> {
	const path = resolve(repoRoot, "package.json");
	if (!(await fileExists(path))) return false;
	const raw = await readFile(path, "utf8");
	const updated = raw.replace(
		/"version"\s*:\s*"[^"]+"/,
		`"version": "${formatSemver(next)}"`,
	);
	if (updated === raw) return false;
	await writeFile(path, updated);
	return true;
}

async function prependChangelog(repoRoot: string, section: string): Promise<void> {
	const path = resolve(repoRoot, "CHANGELOG.md");
	let existing = "";
	if (await fileExists(path)) {
		existing = await readFile(path, "utf8");
	}
	let next: string;
	if (!existing.trim()) {
		next = `# Changelog\n\n${section}\n`;
	} else if (/^# Changelog\b/m.test(existing)) {
		// Insert after the top-level header
		next = existing.replace(
			/(^# Changelog[^\n]*\n+)/,
			`$1${section}\n\n`,
		);
	} else {
		// No top-level header: prepend one
		next = `# Changelog\n\n${section}\n\n${existing}`;
	}
	await writeFile(path, next);
}

async function stageReleaseFiles(
	exec: ExecRunner,
	bumpedPackageJson: boolean,
	signal?: AbortSignal,
): Promise<{ ok: boolean; out: string; files: string[] }> {
	const files = ["CHANGELOG.md", ...(bumpedPackageJson ? ["package.json"] : [])];
	const staged = await execLoud(exec, "git", ["add", "--", ...files], signal);
	return { ...staged, files };
}

function extractReleaseNotes(changelog: string): string {
	// Strip the leading `## [X.Y.Z] — DATE` header; keep the rest.
	return changelog.replace(/^##\s+\[[^\]]+\][^\n]*\n+/, "").trim();
}

// ── Phase: full release execution ────────────────────────────

async function executeRelease(
	exec: ExecRunner,
	plan: ReleasePlan,
	provider: Provider,
	defaultBranch: string,
	repoRoot: string,
	ctx: ExtensionCommandContext,
	signal?: AbortSignal,
): Promise<void> {
	const versionStr = `v${formatSemver(plan.nextVersion)}`;

	// 1. Confirm
	const okRelease = await ctx.ui.confirm(
		`Release ${versionStr}?`,
		`Will bump package.json, prepend CHANGELOG.md, commit \`chore: release ${versionStr}\`, tag annotated, and prepare to push.`,
	);
	if (!okRelease) {
		ctx.ui.notify("Release cancelled.", "info");
		return;
	}

	// 2. Bump manifest
	const bumped = await bumpPackageJson(repoRoot, plan.nextVersion);
	console.log(bumped ? `Bumped package.json → ${formatSemver(plan.nextVersion)}` : "No package.json found; skipping manifest bump.");

	// 3. Prepend changelog
	await prependChangelog(repoRoot, plan.changelog);
	console.log("Prepended CHANGELOG.md");

	// 4. Stage and commit. Use explicit git add instead of `commit -am` so a
	// newly-created CHANGELOG.md is included in first-release repos.
	const stage = await stageReleaseFiles(exec, bumped, signal);
	if (!stage.ok) {
		ctx.ui.notify(`git add failed:\n${stage.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "commit")}`, "error");
		return;
	}
	const commit = await execLoud(exec, "git", ["commit", "-m", `chore: release ${versionStr}`], signal);
	if (!commit.ok) {
		ctx.ui.notify(`git commit failed:\n${commit.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "commit")}`, "error");
		return;
	}
	console.log(commit.out);

	// 5. Tag annotated
	const tag = await execLoud(exec, "git", ["tag", "-a", versionStr, "-m", versionStr], signal);
	if (!tag.ok) {
		ctx.ui.notify(`git tag failed:\n${tag.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "tag")}`, "error");
		return;
	}
	console.log(`Tagged ${versionStr}`);

	// 6. Confirm push
	const okPush = await ctx.ui.confirm(
		`Push ${versionStr} to origin/${defaultBranch}?`,
		`Will run \`git push origin ${defaultBranch} --follow-tags\`.`,
	);
	if (!okPush) {
		ctx.ui.notify(
			`Local commit and tag created but not pushed.\n\n${formatRecoverySteps(versionStr, defaultBranch, "push")}`,
			"warning",
		);
		return;
	}

	// 7. Push
	const push = await execLoud(
		exec,
		"git",
		["push", "origin", defaultBranch, "--follow-tags"],
		signal,
	);
	if (!push.ok) {
		ctx.ui.notify(`git push failed:\n${push.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "push")}`, "error");
		return;
	}
	console.log(push.out);

	// 8. Provider release
	const notes = extractReleaseNotes(plan.changelog);
	if (provider === "github") {
		const rel = await execLoud(
			exec,
			"gh",
			["release", "create", versionStr, "--title", versionStr, "--notes", notes],
			signal,
		);
		if (!rel.ok) {
			ctx.ui.notify(
				`gh release create failed (tag is pushed; release notes not published):\n${rel.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "provider-release")}`,
				"warning",
			);
		} else {
			console.log(rel.out);
		}
	} else if (provider === "gitlab") {
		const rel = await execLoud(
			exec,
			"glab",
			["release", "create", versionStr, "--name", versionStr, "--notes", notes],
			signal,
		);
		if (!rel.ok) {
			ctx.ui.notify(
				`glab release create failed (tag is pushed; release notes not published):\n${rel.out}\n\n${formatRecoverySteps(versionStr, defaultBranch, "provider-release")}`,
				"warning",
			);
		} else {
			console.log(rel.out);
		}
	} else {
		ctx.ui.notify(
			`Provider \`${provider}\` does not support automated release publishing — tag is pushed but no release notes were created on the host.`,
			"info",
		);
	}

	ctx.ui.notify(`Released ${versionStr}.`, "info");
}

// ── Slash command ────────────────────────────────────────────

const ARG_PATTERNS = {
	status: /^(status|--?dry-run)\b/,
	bumpOverride: /^(patch|minor|major)$/,
};

export default function gitReleaseExtension(pi: ExtensionAPI) {
	pi.registerCommand("release", {
		description:
			"Read latest tag and CC log, compute next semver, and either preview the plan (`/release status`) or apply it (`/release` or `/release patch|minor|major` to override the bump).",
		handler: async (args, ctx) => {
			const exec: ExecRunner = (cmd, eargs, opts) => pi.exec(cmd, eargs, opts);
			const signal = ctx.signal;
			const trimmed = (args ?? "").trim().toLowerCase();
			const isStatus = ARG_PATTERNS.status.test(trimmed);
			const overrideMatch = trimmed.match(ARG_PATTERNS.bumpOverride);
			const override = (overrideMatch?.[1] ?? null) as Bump | null;

			// Read repo state
			const remoteUrl = await tryExec(exec, "git", ["remote", "get-url", "origin"], signal);
			const hasRemote = remoteUrl !== null;
			const provider = detectProvider(remoteUrl);
			const currentBranch =
				(await tryExec(exec, "git", ["branch", "--show-current"], signal)) ?? "";
			const defaultBranch = await detectDefaultBranch(exec, signal);
			const status = await tryExec(exec, "git", ["status", "--porcelain"], signal);
			const repoRoot =
				(await tryExec(exec, "git", ["rev-parse", "--show-toplevel"], signal)) ??
				ctx.cwd;

			if (currentBranch !== defaultBranch) {
				ctx.ui.notify(
					`Releases run from the default branch. Currently on \`${currentBranch || "(detached)"}\`; switch to \`${defaultBranch}\` first.`,
					"error",
				);
				return;
			}
			if (!isStatus && status !== "") {
				ctx.ui.notify(
					"Working tree is dirty. Commit or stash before releasing.",
					"error",
				);
				return;
			}

			const plan = await readReleasePlan(exec, override ?? undefined, signal);
			console.log(formatPlan(plan, isStatus ? "status" : "execute"));

			if (isStatus) return;

			if (plan.bump === "none") {
				ctx.ui.notify(
					"No bump-worthy commits since last release. Use `/release patch`, `/release minor`, or `/release major` to override.",
					"warning",
				);
				return;
			}

			const versionStr = `v${formatSemver(plan.nextVersion)}`;
			const safety = await preflightReleaseSafety(exec, versionStr, provider, hasRemote, signal);
			for (const warning of safety.warnings) ctx.ui.notify(warning, "warning");
			if (!safety.ok) {
				ctx.ui.notify(
					`Release safety checks failed before mutation:\n${safety.failures.map((f) => `  - ${f}`).join("\n")}`,
					"error",
				);
				return;
			}

			await executeRelease(exec, plan, provider, defaultBranch, repoRoot, ctx, signal);
		},
	});
}

// ── Re-exports for tests / consumers ─────────────────────────

export {
	parseSemver,
	formatSemver,
	applyBump,
	classifyCommit,
	computeBump,
	buildChangelog,
	extractReleaseNotes,
	stageReleaseFiles,
	tagExists,
	checkProviderAuth,
	preflightReleaseSafety,
	formatRecoverySteps,
};
