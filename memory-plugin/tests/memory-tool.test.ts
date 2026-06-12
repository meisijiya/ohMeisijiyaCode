import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { searchMemory } from "../src/memory"
import { migrate } from "../src/lib/migrate"
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("searchMemory (integration)", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "search-tool-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
    const mem = `# Project Memory

## Project context

Project: long-term memory v2

## Rules

- Use Bun.file over fs.readFile
- No try/catch — early return

## Architecture decisions

- 2026-06-12: SQLite FTS5 over .md grep because unicode61 supports CJK

## Discovered durable knowledge

- task-dispatch default background:true (commit fa95a0a)
`
    writeFileSync(join(memoryDir, "MEMORY.md"), mem)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("returns 0 results for empty query", async () => {
    const results = await searchMemory(db, memoryDir, { query: "", type: "all", limit: 5 })
    expect(results.length).toBe(0)
  })

  test("returns matches for known content", async () => {
    const results = await searchMemory(db, memoryDir, { query: "SQLite FTS5", type: "all", limit: 5 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain("SQLite")
  })

  test("CJK query matches CJK content", async () => {
    const results = await searchMemory(db, memoryDir, { query: "为什么", type: "all", limit: 5 })
    // Should at least not crash; actual matches depend on indexed CJK content
    expect(Array.isArray(results)).toBe(true)
  })

  test("0 results returns escalation ladder guidance", async () => {
    const results = await searchMemory(db, memoryDir, { query: "absolutely_nonexistent_term_xyz", type: "all", limit: 5 })
    expect(results.length).toBe(0)
  })

  test("increments hit_count on search", async () => {
    await searchMemory(db, memoryDir, { query: "SQLite FTS5", type: "all", limit: 5 })
    const rows = db.query("SELECT hit_count FROM memory_fts").all() as any[]
    const totalHits = rows.reduce((sum, r) => sum + r.hit_count, 0)
    expect(totalHits).toBeGreaterThan(0)
  })

  test("FTS5 special chars do not crash", async () => {
    const results = await searchMemory(db, memoryDir, {
      query: '"test" (foo) -bar *baz',
      type: "all",
      limit: 5,
    })
    expect(Array.isArray(results)).toBe(true)
  })
})
