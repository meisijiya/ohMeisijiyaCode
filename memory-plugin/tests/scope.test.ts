import { describe, test, expect } from "bun:test"
import { parsePath, buildPath, resolveProjectId, assertSafeComponent } from "../src/lib/scope"

describe("parsePath", () => {
  test("parses project MEMORY.md", () => {
    const p = parsePath("/home/user/proj/data/memory/projects/abc123/MEMORY.md")
    expect(p).toEqual({
      scope: "projects",
      scope_id: "abc123",
      type: "memory",
      key: "MEMORY",
    })
  })

  test("returns null for path outside memory layout", () => {
    expect(parsePath("/tmp/random.txt")).toBeNull()
  })

  test("returns null for non-md extension", () => {
    expect(parsePath("/home/user/proj/data/memory/projects/abc/MEMORY.txt")).toBeNull()
  })
})

describe("buildPath", () => {
  test("builds project path", () => {
    const p = buildPath({ root: "/data/memory", scope: "projects", scope_id: "abc", key: "MEMORY" })
    expect(p).toBe("/data/memory/projects/abc/MEMORY.md")
  })

  test("builds global path (empty scope_id)", () => {
    const p = buildPath({ root: "/data/memory", scope: "global", key: "MEMORY" })
    expect(p).toBe("/data/memory/global/MEMORY.md")
  })

  test("rejects '..' in scope_id", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "../etc", key: "MEMORY" }),
    ).toThrow(/invalid path component/)
  })

  test("rejects '..' in key", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "abc", key: "../passwd" }),
    ).toThrow(/invalid path component/)
  })

  test("rejects absolute path in scope_id", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "/etc", key: "MEMORY" }),
    ).toThrow(/invalid path component/)
  })
})

describe("resolveProjectId", () => {
  test("returns 12-char sha256 prefix", () => {
    const id = resolveProjectId("/home/user/some/repo")
    expect(id).toHaveLength(12)
    expect(id).toMatch(/^[a-f0-9]{12}$/)
  })

  test("same path → same id (deterministic)", () => {
    const a = resolveProjectId("/home/user/repo")
    const b = resolveProjectId("/home/user/repo")
    expect(a).toBe(b)
  })

  test("different path → different id", () => {
    const a = resolveProjectId("/home/user/repo1")
    const b = resolveProjectId("/home/user/repo2")
    expect(a).not.toBe(b)
  })
})

describe("assertSafeComponent", () => {
  test("accepts normal alphanumeric", () => {
    expect(() => assertSafeComponent("abc123")).not.toThrow()
  })

  test("accepts path with safe segments", () => {
    expect(() => assertSafeComponent("a/b/c")).not.toThrow()
  })

  test("rejects '..' segment", () => {
    expect(() => assertSafeComponent("a/../b")).toThrow()
  })
})
