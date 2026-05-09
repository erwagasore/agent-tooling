import { describe, expect, it } from "vitest";
import planCycleExtension from "../pi-extensions/plan-cycle/index.ts";
import peculiarsExtension from "../pi-extensions/peculiars/index.ts";

function createCommandPi() {
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const sent: string[] = [];
	const pi = {
		registerCommand: (name: string, definition: { handler: (args: string, ctx: any) => Promise<void> }) => {
			commands.set(name, definition);
		},
		sendUserMessage: async (message: string) => {
			sent.push(message);
		},
	} as any;
	return { pi, commands, sent };
}

function createPlanCtx(opts: {
	active?: boolean;
	choice?: string;
	freshSent?: string[];
} = {}) {
	const freshSent = opts.freshSent ?? [];
	return {
		sessionManager: {
			getEntries: () =>
				opts.active
					? [{ type: "message", message: { role: "user", content: "hello" } }]
					: [],
			getSessionFile: () => "/tmp/session.json",
		},
		ui: {
			select: async () => opts.choice,
		},
		newSession: async ({ parentSession, withSession }: { parentSession?: string; withSession: (ctx: any) => Promise<void> }) => {
			expect(parentSession).toBe("/tmp/session.json");
			await withSession({
				sendUserMessage: async (message: string) => {
					freshSent.push(message);
				},
			});
		},
	} as any;
}

async function runPlan(args: string, ctx = createPlanCtx()) {
	const { pi, commands, sent } = createCommandPi();
	planCycleExtension(pi);
	const command = commands.get("plan");
	expect(command).toBeDefined();
	await command!.handler(args, ctx);
	return { sent };
}

describe("plan-cycle extension", () => {
	it("runs create-plan in the current model when no model argument is given", async () => {
		await expect(runPlan("")).resolves.toEqual({ sent: ["/skill:create-plan"] });
	});

	it("switches model then plans when the session is empty", async () => {
		await expect(runPlan("claude-opus-4-7", createPlanCtx({ active: false }))).resolves.toEqual({
			sent: ["/model claude-opus-4-7", "/skill:create-plan"],
		});
	});

	it("keeps current model for active conversations when requested", async () => {
		await expect(
			runPlan("claude-opus-4-7", createPlanCtx({ active: true, choice: "Keep current model and plan now" })),
		).resolves.toEqual({ sent: ["/skill:create-plan"] });
	});

	it("switches model in-place for active conversations when requested", async () => {
		await expect(
			runPlan(
				"claude-opus-4-7",
				createPlanCtx({ active: true, choice: "Switch model in place (history kept)" }),
			),
		).resolves.toEqual({ sent: ["/model claude-opus-4-7", "/skill:create-plan"] });
	});

	it("cancels model switching without sending messages", async () => {
		await expect(
			runPlan("claude-opus-4-7", createPlanCtx({ active: true, choice: "Cancel" })),
		).resolves.toEqual({ sent: [] });
	});

	it("starts a fresh session for active conversations when requested", async () => {
		const freshSent: string[] = [];
		await expect(
			runPlan(
				"claude-opus-4-7",
				createPlanCtx({
					active: true,
					choice: "Start fresh session at new model",
					freshSent,
				}),
			),
		).resolves.toEqual({ sent: [] });
		expect(freshSent).toEqual(["/model claude-opus-4-7", "/skill:create-plan"]);
	});
});

function createEventPi() {
	const events = new Map<string, (event: any, ctx: any) => Promise<void>>();
	const pi = {
		on: (name: string, handler: (event: any, ctx: any) => Promise<void>) => {
			events.set(name, handler);
		},
	} as any;
	return { pi, events };
}

describe("peculiars extension", () => {
	it("sets and clears working messages for UI contexts", async () => {
		const { pi, events } = createEventPi();
		const messages: Array<string | undefined> = [];
		const ctx = {
			hasUI: true,
			ui: { setWorkingMessage: (message?: string) => messages.push(message) },
		};

		peculiarsExtension(pi);
		await events.get("before_agent_start")!({}, ctx);
		await events.get("turn_start")!({ turnIndex: 1 }, ctx);
		await events.get("tool_call")!({ toolName: "read" }, ctx);
		await events.get("agent_end")!({}, ctx);
		await events.get("session_start")!({}, ctx);

		expect(messages.length).toBe(5);
		expect(messages.slice(0, 3).every((m) => typeof m === "string" && m.length > 0)).toBe(true);
		expect(messages.slice(3)).toEqual([undefined, undefined]);
	});

	it("does not update working messages for headless contexts", async () => {
		const { pi, events } = createEventPi();
		const calls: Array<string | undefined> = [];
		const ctx = {
			hasUI: false,
			ui: { setWorkingMessage: (message?: string) => calls.push(message) },
		};

		peculiarsExtension(pi);
		await events.get("before_agent_start")!({}, ctx);
		await events.get("tool_call")!({ toolName: "bash" }, ctx);
		await events.get("agent_end")!({}, ctx);

		expect(calls).toEqual([]);
	});

	it("ignores unknown tool names", async () => {
		const { pi, events } = createEventPi();
		const calls: Array<string | undefined> = [];
		const ctx = {
			hasUI: true,
			ui: { setWorkingMessage: (message?: string) => calls.push(message) },
		};

		peculiarsExtension(pi);
		await events.get("tool_call")!({ toolName: "unknown-tool" }, ctx);

		expect(calls).toEqual([]);
	});
});
