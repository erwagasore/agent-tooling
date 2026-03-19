/**
 * peculiars — witty status messages during agent processing.
 *
 * Shows context-aware quips in the working indicator (TUI) as the
 * agent thinks, reads, edits, and runs commands.
 *
 * Uses setWorkingMessage to replace the default working indicator text.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ── Message pools ────────────────────────────────────────────

const startMessages = [
  "🤔 Pondering the meaning of your prompt…",
  "🧠 Warming up the neurons…",
  "📡 Receiving transmission…",
  "🎯 Locking onto the problem…",
  "🌀 Entering the flow state…",
];

const turnMessages = [
  "🔄 Another round…",
  "🎪 And for my next trick…",
  "🏃 Still going…",
  "🧩 Fitting the pieces together…",
  "🎶 Finding the rhythm…",
  "⚙️ Cranking the gears…",
];

const toolMessages: Record<string, string[]> = {
  read: [
    "📖 Skimming through the source…",
    "👀 Taking a closer look…",
    "🔍 Inspecting the evidence…",
    "📂 Flipping through files…",
  ],
  bash: [
    "⚡ Running something spicy…",
    "🐚 Whispering to the shell…",
    "💻 Executing orders…",
    "🔨 Hammering out a command…",
  ],
  edit: [
    "✏️ Performing surgery…",
    "⚕️ Precision editing…",
    "🔧 Turning a wrench…",
    "🪡 Threading the needle…",
  ],
  write: [
    "✨ Composing a masterpiece…",
    "🖊️ Putting pen to paper…",
    "✍️ Drafting something fresh…",
    "📄 Creating from scratch…",
  ],
  grep: [
    "🔎 Scouring the codebase…",
    "🕵️ Searching for clues…",
  ],
  find: [
    "🗺️ Mapping the territory…",
    "📍 Locating targets…",
  ],
  ls: [
    "📋 Taking inventory…",
    "🗂️ Checking the contents…",
  ],
};

// ── Helpers ──────────────────────────────────────────────────

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setVibe(ctx: ExtensionContext, message?: string) {
  if (!ctx.hasUI) return;
  ctx.ui.setWorkingMessage(message);
}

// ── Extension ────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    setVibe(ctx, pick(startMessages));
  });

  pi.on("turn_start", async (event, ctx) => {
    if (event.turnIndex > 0) {
      setVibe(ctx, pick(turnMessages));
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    const messages = toolMessages[event.toolName];
    if (messages) setVibe(ctx, pick(messages));
  });

  pi.on("agent_end", async (_event, ctx) => {
    setVibe(ctx);
  });

  // Clear on session boundaries so stale vibes don't linger.
  pi.on("session_start", async (_event, ctx) => {
    setVibe(ctx);
  });
}
