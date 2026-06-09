import { test, expect } from "bun:test";
import type { ToolContext, ToolResult } from "@opencode-ai/plugin/tool";

/**
 * Normalize a ToolResult to a plain string for assertion purposes.
 */
function toText(result: ToolResult): string {
  if (typeof result === "string") return result;
  return result.output;
}

const mockContext = {
  sessionID: "test",
  messageID: "test",
  agent: "test",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
} as unknown as ToolContext;

test("web-search module loads and exports a default tool object", async () => {
  const mod = await import("./web-search");
  expect(mod).toBeDefined();
  expect(typeof mod.default).toBe("object");
  expect(typeof mod.default.execute).toBe("function");
  expect(typeof mod.default.description).toBe("string");
});

test("description mentions provider chain and DuckDuckGo fallback", async () => {
  const mod = await import("./web-search");
  const desc = mod.default.description;
  expect(desc).toMatch(/Exa/i);
  expect(desc).toMatch(/Brave/i);
  expect(desc).toMatch(/DuckDuckGo/i);
});

test("args schema exposes query, provider, max_results", async () => {
  const mod = await import("./web-search");
  const args = mod.default.args;
  expect(args).toBeDefined();
  expect(args.query).toBeDefined();
  expect(args.provider).toBeDefined();
  expect(args.max_results).toBeDefined();
});

/**
 * Probe whether outbound HTTPS to duckduckgo.com is reachable.
 * Network-dependent tests skip themselves when offline so the suite
 * stays green in air-gapped CI but still validates real DDG output
 * when network is available.
 */
async function networkReachable(): Promise<boolean> {
  if (process.env.WEB_SEARCH_SKIP_NETWORK === "1") return false;
  try {
    const proc = Bun.spawn(["curl", "-sS", "-o", "/dev/null", "--max-time", "3", "-A", "probe/1.0", "https://lite.duckduckgo.com/"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

test("auto mode with no API keys falls back to DuckDuckGo (no crash)", async () => {
  if (!(await networkReachable())) {
    // 离线环境: 跳过真实网络测试,但仍应验证 module 不抛
    return;
  }
  // Ensure no provider keys are set during this test
  const savedKeys: Record<string, string | undefined> = {};
  for (const k of ["EXA_API_KEY", "BRAVE_API_KEY", "TAVILY_API_KEY", "PERPLEXITY_API_KEY"]) {
    savedKeys[k] = process.env[k];
    delete process.env[k];
  }
  try {
    const mod = await import("./web-search");
    const result = await mod.default.execute(
      { query: "opencode ai", provider: "auto", max_results: 3 },
      mockContext,
    );
    const text = toText(result);
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
  } finally {
    for (const [k, v] of Object.entries(savedKeys)) {
      if (v !== undefined) process.env[k] = v;
    }
  }
});

test("pinned duckduckgo provider returns a string response (no crash)", async () => {
  if (!(await networkReachable())) return;
  const mod = await import("./web-search");
  const result = await mod.default.execute(
    { query: "test query", provider: "duckduckgo", max_results: 3 },
    mockContext,
  );
  const text = toText(result);
  expect(text).toBeDefined();
  expect(text.length).toBeGreaterThan(0);
});

test("pinned unknown provider returns an error string", async () => {
  const mod = await import("./web-search");
  // Force-cast to bypass zod validation that would catch this in real use
  const result = await (mod.default.execute as any)(
    { query: "test", provider: "nonexistent_provider_xyz", max_results: 3 },
    mockContext,
  );
  const text = toText(result);
  expect(text.toLowerCase()).toMatch(/error|unknown/);
});

test("provider with no API key set returns an error string", async () => {
  // Temporarily unset the key
  const saved = process.env.BRAVE_API_KEY;
  delete process.env.BRAVE_API_KEY;
  try {
    const mod = await import("./web-search");
    const result = await mod.default.execute(
      { query: "test", provider: "brave", max_results: 3 },
      mockContext,
    );
    const text = toText(result);
    expect(text).toMatch(/not set|error/i);
  } finally {
    if (saved !== undefined) process.env.BRAVE_API_KEY = saved;
  }
});
