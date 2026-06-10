// @bun
// src/orchestrator.ts
var KARPATHY_PATH = `${process.env.HOME}/.config/opencode/skills/karpathy-guidelines/SKILL.md`;
var OPENCODE_CONFIG_PATH = `${process.env.HOME}/.config/opencode/opencode.json`;
var TIER_AGENTS = ["sisyphus", "lyra", "hephaestus"];
var karpathyContent = null;
async function loadKarpathy() {
  if (karpathyContent !== null)
    return karpathyContent;
  try {
    const text = await Bun.file(KARPATHY_PATH).text();
    karpathyContent = text.length > 0 ? text : "";
  } catch {
    karpathyContent = "";
  }
  return karpathyContent || null;
}
async function loadProjectAgents(directory) {
  try {
    const text = await Bun.file(`${directory}/AGENTS.md`).text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
async function checkThreeTierConfig() {
  try {
    const raw = await Bun.file(OPENCODE_CONFIG_PATH).text();
    const config = JSON.parse(raw);
    const agents = config?.agent ?? {};
    const globalModel = config?.model;
    const missing = TIER_AGENTS.filter((name) => {
      const agent = agents[name];
      return !agent || !agent.model && !globalModel;
    });
    if (missing.length === 0)
      return null;
    return `
[3-tier config warning] Agents without explicit model: ${missing.join(", ")}. ` + `Add a "model" field to each in opencode.json (e.g., "anthropic/claude-opus-4" for high).`;
  } catch {
    return null;
  }
}
var OrchestratorPlugin = async (ctx) => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const injections = [];
      const karpathy = await loadKarpathy();
      if (karpathy) {
        injections.push(`[karpathy-guidelines 4 \u539F\u5219 - \u5143\u89C4\u5219\uFF0C\u8986\u76D6\u6240\u6709\u5DE5\u4F5C\u6D41]
${karpathy}
[end karpathy]`);
      }
      const projectAgents = await loadProjectAgents(ctx.directory);
      if (projectAgents) {
        injections.push(`[\u9879\u76EE\u7EA7 AGENTS.md]
${projectAgents}
[end AGENTS.md]`);
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
    "chat.message": async (_input, output) => {
      const text = output.parts?.map((p) => typeof p === "string" ? p : p?.text ?? "").join(" ") || "";
      const reminders = [];
      if (/\b(ultrawork|ulw)\b/i.test(text)) {
        reminders.push(`[ultrawork mode activated]
` + `\u5DE5\u4F5C\u534F\u8BAE\u5DF2\u6FC0\u6D3B\uFF1A
` + `1. \u4E0D\u505C\u6B62\u76F4\u5230 todo \u5168\u90E8\u5B8C\u6210
` + `2. \u5E76\u884C\u6267\u884C\u6240\u6709\u72EC\u7ACB\u64CD\u4F5C
` + `3. \u6301\u7EED\u68C0\u67E5 karpathy 4 \u539F\u5219
` + `4. \u5931\u8D25\u65F6\u7ACB\u5373\u62A5\u544A\uFF0C\u4E0D\u63A9\u9970
`);
      }
      if (/\b(search|\u641C\u7D22|\u627E|\u67E5)\b/i.test(text)) {
        reminders.push(`[search hint]
\u8003\u8651\u59D4\u6D3E oracle \u5B50 agent \u505A\u5E76\u884C\u641C\u7D22\uFF0C\u907F\u514D\u4E3B\u4E0A\u4E0B\u6587\u6C61\u67D3\u3002
`);
      }
      if (reminders.length > 0) {
        output.parts = output.parts || [];
        output.parts.push({
          type: "text",
          text: reminders.join(`
`),
          synthetic: true
        });
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      const karpathy = await loadKarpathy();
      if (karpathy) {
        output.context = output.context || [];
        output.context.push(`[karpathy-guidelines (re-injected pre-compaction)]
${karpathy}`);
      }
    }
  };
};
var orchestrator_default = OrchestratorPlugin;
export {
  orchestrator_default as default,
  OrchestratorPlugin
};
