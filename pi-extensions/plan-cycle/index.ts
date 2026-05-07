/**
 * plan-cycle — model-aware /plan command wrapping the create-plan skill.
 *
 * Usage:
 *   /plan                          run create-plan in the current model
 *   /plan claude-opus-4-7          switch to that model, then plan
 *   /plan <model-id>               any id Pi's /model command accepts
 *
 * Delegates the actual model switch to Pi's built-in /model rather than
 * re-implementing provider/id resolution.
 *
 * If a conversation is already in progress when a model arg is given, the user
 * is asked to: keep the current model, switch in place (Pi retains the log),
 * start a fresh session at the new model, or cancel.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";

// ── Choice constants ─────────────────────────────────────────

const KEEP = "Keep current model and plan now";
const SWITCH = "Switch model in place (history kept)";
const FRESH = "Start fresh session at new model";
const CANCEL = "Cancel";

// ── Helpers ──────────────────────────────────────────────────

function hasActiveConversation(ctx: ExtensionCommandContext): boolean {
  return ctx.sessionManager.getEntries().some(
    (e) =>
      e.type === "message" &&
      (e.message.role === "user" || e.message.role === "assistant"),
  );
}

// ── Extension ────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("plan", {
    description:
      "Draft docs/plan.md from the current conversation. Optional: /plan <model-id> uses Pi's /model id format, e.g. /plan claude-opus-4-7",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const modelId = (args ?? "").trim();

      // No model arg → run the skill in the current model.
      if (!modelId) {
        await pi.sendUserMessage("/skill:create-plan");
        return;
      }

      // Empty session → switch and run.
      if (!hasActiveConversation(ctx)) {
        await pi.sendUserMessage(`/model ${modelId}`);
        await pi.sendUserMessage("/skill:create-plan");
        return;
      }

      // Active conversation → ask before changing anything.
      const choice = await ctx.ui.select(
        `Switching to ${modelId} mid-conversation. What do you want to do?`,
        [KEEP, SWITCH, FRESH, CANCEL],
      );

      if (!choice || choice === CANCEL) return;

      if (choice === KEEP) {
        await pi.sendUserMessage("/skill:create-plan");
        return;
      }

      if (choice === SWITCH) {
        await pi.sendUserMessage(`/model ${modelId}`);
        await pi.sendUserMessage("/skill:create-plan");
        return;
      }

      // FRESH: new session seeded with model select + plan invocation.
      const parentSession = ctx.sessionManager.getSessionFile() ?? undefined;
      await ctx.newSession({
        parentSession,
        withSession: async (newCtx) => {
          // Captured `pi` is stale after replacement — use only newCtx.
          await newCtx.sendUserMessage(`/model ${modelId}`);
          await newCtx.sendUserMessage("/skill:create-plan");
        },
      });
    },
  });
}
