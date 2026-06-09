import { test, expect } from "bun:test";

test("web-search module loads", async () => {
  const mod = await import("./web-search");
  expect(typeof mod.default).toBe("object");
  expect(typeof mod.default.execute).toBe("function");
  expect(typeof mod.default.description).toBe("string");
});

test("description mentions MiniMax", async () => {
  const mod = await import("./web-search");
  expect(mod.default.description).toMatch(/MiniMax/i);
});

test("error when no credentials", async () => {
  // Save and clear env
  const savedKey = process.env.MINIMAX_API_KEY;
  const savedHome = process.env.HOME;
  delete process.env.MINIMAX_API_KEY;
  process.env.HOME = "/nonexistent";

  try {
    const mod = await import("./web-search");
    const result = await mod.default.execute(
      { query: "test", max_results: 5 } as any,
      {} as any,
    );
    expect(result).toMatch(/Error: MiniMax credentials not found/);
  } finally {
    if (savedKey) process.env.MINIMAX_API_KEY = savedKey;
    process.env.HOME = savedHome;
  }
});
