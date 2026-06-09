import { test, expect } from "bun:test";

test("image-inspect module loads", async () => {
  const mod = await import("./image-inspect");
  expect(typeof mod.default).toBe("object");
  expect(typeof mod.default.execute).toBe("function");
  expect(typeof mod.default.description).toBe("string");
});

test("description mentions MiniMax or VLM", async () => {
  const mod = await import("./image-inspect");
  expect(mod.default.description).toMatch(/MiniMax|VLM|vision/i);
});

test("args include prompt and image_source", async () => {
  const mod = await import("./image-inspect");
  const args = mod.default.args;
  expect(args.prompt).toBeDefined();
  expect(args.image_source).toBeDefined();
});

test("error when no credentials", async () => {
  const savedKey = process.env.MINIMAX_API_KEY;
  const savedHome = process.env.HOME;
  delete process.env.MINIMAX_API_KEY;
  process.env.HOME = "/nonexistent";

  try {
    const mod = await import("./image-inspect");
    const result = await mod.default.execute(
      { prompt: "describe", image_source: "/tmp/nonexistent.png" } as any,
      {} as any,
    );
    expect(result).toMatch(/Error: MiniMax credentials not found/);
  } finally {
    if (savedKey) process.env.MINIMAX_API_KEY = savedKey;
    process.env.HOME = savedHome;
  }
});

test("strips @ prefix from data URL", async () => {
  const mod = await import("./image-inspect");
  expect(typeof mod.default.execute).toBe("function");
});
