import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

type ExecResult = Awaited<ReturnType<ExtensionAPI["exec"]>>;
type ExecRunner = ExtensionAPI["exec"];

type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];
type CommandDefinition = Parameters<ExtensionAPI["registerCommand"]>[1];

export interface MockPi {
	pi: ExtensionAPI;
	commands: Map<string, CommandDefinition>;
	tools: Map<string, ToolDefinition>;
}

export function createMockPi(exec?: ExecRunner): MockPi {
	const commands = new Map<string, CommandDefinition>();
	const tools = new Map<string, ToolDefinition>();
	const fallbackExec: ExecRunner = async (cmd, args) => ({
		stdout: "",
		stderr: `No mock exec registered for ${cmd} ${(args ?? []).join(" ")}`,
		code: 127,
		killed: false,
	});

	const pi = {
		exec: exec ?? fallbackExec,
		registerCommand: (name: string, definition: CommandDefinition) => {
			commands.set(name, definition);
		},
		registerTool: (definition: ToolDefinition) => {
			tools.set(definition.name, definition);
		},
		on: () => {},
		registerShortcut: () => {},
		registerFlag: () => {},
		registerProvider: () => {},
		registerMessageRenderer: () => {},
		sendMessage: () => {},
		sendUserMessage: () => {},
		appendEntry: () => {},
		setSessionName: () => {},
		getSessionName: () => undefined,
		setLabel: () => {},
		setActiveTools: () => {},
		getAllTools: () => [],
		getCommands: () => [],
		getFlag: () => undefined,
		setThinkingLevel: () => {},
	} as unknown as ExtensionAPI;

	return { pi, commands, tools };
}

export function createCommandContext(overrides: Partial<ExtensionCommandContext> = {}): ExtensionCommandContext {
	return {
		cwd: process.cwd(),
		signal: undefined,
		hasUI: true,
		ui: {
			notify: () => {},
			confirm: async () => false,
			input: async (_prompt: string, defaultValue?: string) => defaultValue ?? "",
			setStatus: () => {},
			setWidget: () => {},
			setTitle: () => {},
			setEditorText: () => {},
		},
		sessionManager: { getEntries: () => [] },
		...overrides,
	} as ExtensionCommandContext;
}

export type { ExecResult, ExecRunner };
