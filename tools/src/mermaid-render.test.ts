import { test, expect } from "bun:test";
test("mermaid-render module loads", async () => {
  const mod = await import("./mermaid-render");
  expect(typeof mod.default).toBe("object");
  expect(typeof mod.default.execute).toBe("function");
});
