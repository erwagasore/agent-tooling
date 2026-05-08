import { describe, expect, it } from "vitest";
import { detectShipState } from "../pi-extensions/git-ship/index.ts";

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
