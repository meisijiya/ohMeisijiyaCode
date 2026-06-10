import { test, expect } from "bun:test";

test("task-dispatch module loads", async () => {
  const mod = await import("./task-dispatch");
  expect(typeof mod.default).toBe("object");
  expect(typeof mod.default.execute).toBe("function");
  expect(typeof mod.default.description).toBe("string");
});

test("description mentions MCP proxy", async () => {
  const mod = await import("./task-dispatch");
  expect(mod.default.description).toMatch(/mcp/i);
});

test("args include subagent_type, description, prompt, background, timeout_ms", async () => {
  const mod = await import("./task-dispatch");
  const args = mod.default.args;
  expect(args.subagent_type).toBeDefined();
  expect(args.description).toBeDefined();
  expect(args.prompt).toBeDefined();
  expect(args.background).toBeDefined();
  expect(args.timeout_ms).toBeDefined();
});

test("MCP proxy format recognized in subagent_type", async () => {
  const mod = await import("./task-dispatch");
  const result = await mod.default.execute(
    {
      subagent_type: "mcp:MiniMax:web_search",
      description: "test search",
      prompt: "hello world",
      background: false,
      timeout_ms: undefined,
    } as any,
    {} as any,
  );
  expect(result).toMatch(/"kind":\s*"mcp"/);
  expect(result).toMatch(/"server":\s*"MiniMax"/);
  expect(result).toMatch(/"tool":\s*"web_search"/);
});

test("invalid MCP format returns error", async () => {
  const mod = await import("./task-dispatch");
  const result = await mod.default.execute(
    {
      subagent_type: "mcp:bad",
      description: "test",
      prompt: "x",
      background: false,
    } as any,
    {} as any,
  );
  expect(result).toMatch(/Invalid MCP format/);
});

test("agent dispatch returns normalized parameters", async () => {
  const mod = await import("./task-dispatch");
  const result = await mod.default.execute(
    {
      subagent_type: "lyra",
      description: "test research",
      prompt: "find X",
      background: true,
      timeout_ms: 30000,
    } as any,
    {} as any,
  );
  expect(result).toMatch(/"kind":\s*"agent"/);
  expect(result).toMatch(/"subagent_type":\s*"lyra"/);
  expect(result).toMatch(/"background":\s*true/);
  expect(result).toMatch(/"timeout_ms":\s*30000/);
});