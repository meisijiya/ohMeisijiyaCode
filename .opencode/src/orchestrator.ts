/**
 * Orchestrator Plugin for opencode 1.16.2
 *
 * Implements:
 * - karpathy-guidelines + project AGENTS.md injection via
 *   `experimental.chat.system.transform` (the closest equivalent to a
 *   "session.start" hook — the system prompt is rebuilt per LLM call, so
 *   we re-inject every time).
 * - Keyword detection (ultrawork / ulw / search) via `chat.message`,
 *   injecting a synthetic system reminder into the message parts.
 * - karpathy re-injection on compaction via `experimental.session.compacting`
 *   so principles survive context compression.
 *
 * Note: opencode 1.16.2 does NOT expose `session.start`, `message.user`,
 * `session.idle`, or `session.compact` events — those were plan
 * assumptions. The plugin loader silently ignores unknown keys, so the
 * previous version did nothing at runtime. This rewrite uses the actual
 * `experimental.*` hooks defined in
 * `node_modules/@opencode-ai/plugin/dist/index.d.ts`.
 *
 * Boulder-style autocontinue (preventing premature session idle while
 * todos remain) is deferred: `experimental.compaction.autocontinue` would
 * be the closest hook, but it does not expose todo state to plugins, and
 * opencode has no general "session.idle" equivalent. Until opencode ships
 * a suitable hook, the keyword-triggered work mode is the primary
 * discipline mechanism.
 */

import type { Plugin } from "@opencode-ai/plugin";

const KARPATHY_PATH = `${process.env.HOME}/.config/opencode/skills/karpathy-guidelines/SKILL.md`;
const OPENCODE_CONFIG_PATH = `${process.env.HOME}/.config/opencode/opencode.json`;

const TIER_AGENTS = ["sisyphus", "lyra", "hephaestus"] as const;

let karpathyContent: string | null = null;

async function loadKarpathy(): Promise<string | null> {
  if (karpathyContent !== null) return karpathyContent;
  try {
    const text = await Bun.file(KARPATHY_PATH).text();
    karpathyContent = text.length > 0 ? text : "";
  } catch {
    karpathyContent = "";
  }
  return karpathyContent || null;
}

async function loadProjectAgents(directory: string): Promise<string | null> {
  try {
    const text = await Bun.file(`${directory}/AGENTS.md`).text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Validate 3-tier model configuration in opencode.json.
 * Warns if Sisyphus/Lyra/Hephaestus agents don't have model fields set.
 * Returns null on success, or a warning string listing the missing tiers.
 */
async function checkThreeTierConfig(): Promise<string | null> {
  try {
    const raw = await Bun.file(OPENCODE_CONFIG_PATH).text();
    const config = JSON.parse(raw);
    const agents = (config?.agent ?? {}) as Record<string, { model?: string } | undefined>;
    const globalModel = config?.model;
    const missing = TIER_AGENTS.filter((name) => {
      const agent = agents[name];
      return !agent || (!agent.model && !globalModel);
    });
    if (missing.length === 0) return null;
    return (
      `\n[3-tier config warning] Agents without explicit model: ${missing.join(", ")}. ` +
      `Add a "model" field to each in opencode.json (e.g., "anthropic/claude-opus-4" for high).`
    );
  } catch {
    return null;
  }
}

export const OrchestratorPlugin: Plugin = async (ctx) => {
  return {
    /**
     * Inject karpathy-guidelines + project AGENTS.md into the system prompt
     * for every LLM call. The system prompt is rebuilt per call, so this
     * hook effectively replaces a missing "session.start" event.
     */
    "experimental.chat.system.transform": async (_input, output) => {
      const injections: string[] = [];

      const karpathy = await loadKarpathy();
      if (karpathy) {
        injections.push(
          `[karpathy-guidelines 4 原则 - 元规则，覆盖所有工作流]\n${karpathy}\n[end karpathy]`,
        );
      }

      const projectAgents = await loadProjectAgents(ctx.directory);
      if (projectAgents) {
        injections.push(
          `[项目级 AGENTS.md]\n${projectAgents}\n[end AGENTS.md]`,
        );
      }

      const tierWarning = await checkThreeTierConfig();
      if (tierWarning) {
        injections.push(tierWarning);
      }

      if (injections.length > 0) {
        output.system = output.system || [];
        output.system.push(...injections);
      }
    },

    /**
     * Detect keywords in user messages and inject a synthetic system
     * reminder into the message parts. ultrawork / ulw → activate full
     * work mode; search → suggest delegating to an oracle sub-agent.
     */
    "chat.message": async (_input, output) => {
      const text =
        output.parts
          ?.map((p) => (typeof p === "string" ? p : (p as any)?.text ?? ""))
          .join(" ") || "";

      const reminders: string[] = [];

      if (/\b(ultrawork|ulw)\b/i.test(text)) {
        reminders.push(
          `[ultrawork mode activated]\n` +
            `工作协议已激活：\n` +
            `1. 不停止直到 todo 全部完成\n` +
            `2. 并行执行所有独立操作\n` +
            `3. 持续检查 karpathy 4 原则\n` +
            `4. 失败时立即报告，不掩饰\n`,
        );
      }

      if (/\b(search|搜索|找|查)\b/i.test(text)) {
        reminders.push(
          `[search hint]\n考虑委派 oracle 子 agent 做并行搜索，避免主上下文污染。\n`,
        );
      }

      if (reminders.length > 0) {
        output.parts = output.parts || [];
        output.parts.push({
          type: "text",
          text: reminders.join("\n"),
          synthetic: true,
        } as any);
      }
    },

    /**
     * When compaction is about to run, re-inject karpathy into the
     * compaction context so its principles survive compression.
     */
    "experimental.session.compacting": async (_input, output) => {
      const karpathy = await loadKarpathy();
      if (karpathy) {
        output.context = output.context || [];
        output.context.push(
          `[karpathy-guidelines (re-injected pre-compaction)]\n${karpathy}`,
        );
      }
    },
  };
};

export default OrchestratorPlugin;
