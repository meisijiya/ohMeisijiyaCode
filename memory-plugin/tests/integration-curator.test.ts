import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { searchMemory } from "../src/memory"
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("End-to-end: curator write → FTS5 search", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "e2e-curator-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("curator writes MEMORY.md → search returns it", async () => {
    // Simulate curator's Phase 4 CONSOLIDATE: write MEMORY.md
    const mem = `# Project Memory

## Rules

- Use Bun.file() over fs.readFile
- No try/catch — early return
`
    writeFileSync(join(memoryDir, "MEMORY.md"), mem)

    // Simulate search
    const results = await searchMemory(db, memoryDir, { query: "Bun.file fs.readFile", type: "all", limit: 5 })
    expect(results.length).toBeGreaterThan(0)
    // FTS5 unicode61 tokenizer splits on "." so "Bun.file" → "Bun" + "file"
    expect(results[0].snippet).toMatch(/Bun|file/)
  })

  test("multiple writes → FTS5 reflects latest", async () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "first version: alpha\n")
    await searchMemory(db, memoryDir, { query: "alpha", type: "all", limit: 5 })

    // Update MEMORY.md (curator's later write)
    writeFileSync(join(memoryDir, "MEMORY.md"), "second version: beta\n")
    const results = await searchMemory(db, memoryDir, { query: "alpha", type: "all", limit: 5 })
    expect(results.length).toBe(0) // old content gone

    const newResults = await searchMemory(db, memoryDir, { query: "beta", type: "all", limit: 5 })
    expect(newResults.length).toBe(1) // new content found
  })

  test("search logs every hit", async () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "logged content here\n")
    await searchMemory(db, memoryDir, { query: "logged", type: "all", limit: 5 })
    const logRows = db.query("SELECT * FROM memory_search_log").all() as any[]
    expect(logRows.length).toBeGreaterThan(0)
  })
})
