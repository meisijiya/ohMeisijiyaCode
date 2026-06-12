import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { reconcileMemory, syncOneFile } from "../src/lib/reconcile"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("syncOneFile", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string
  let memFile: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "reconcile-test-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc123")
    mkdirSync(memoryDir, { recursive: true })
    memFile = join(memoryDir, "MEMORY.md")
    writeFileSync(memFile, "# Project Memory\n\n## Project context\n\nTest content\n")
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("inserts new file into memory_fts", () => {
    syncOneFile(db, memFile, "memory")
    const rows = db.query("SELECT path, body FROM memory_fts").all() as any[]
    expect(rows.length).toBe(1)
    expect(rows[0].path).toBe(memFile)
    expect(rows[0].body).toContain("Test content")
  })

  test("updates existing row when fingerprint changes", () => {
    syncOneFile(db, memFile, "memory")
    // Modify file
    writeFileSync(memFile, "# Project Memory\n\n## Project context\n\nUpdated content\n")
    syncOneFile(db, memFile, "memory")
    const rows = db.query("SELECT body FROM memory_fts").all() as any[]
    expect(rows.length).toBe(1) // still one row, not duplicate
    expect(rows[0].body).toContain("Updated content")
  })

  test("skips when fingerprint unchanged (idempotent)", () => {
    syncOneFile(db, memFile, "memory")
    const before = db.query("SELECT last_indexed_at FROM memory_fts").get() as any
    syncOneFile(db, memFile, "memory")
    const after = db.query("SELECT last_indexed_at FROM memory_fts").get() as any
    expect(before.last_indexed_at).toBe(after.last_indexed_at)
  })

  test("FTS5 index updated after INSERT (search finds content)", () => {
    syncOneFile(db, memFile, "memory")
    const results = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("Test") as any[]
    expect(results.length).toBe(1)
  })
})

describe("reconcileMemory (full walk)", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "reconcile-full-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("indexes all .md files under memoryDir", () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "memory content 1")
    writeFileSync(join(memoryDir, "NOTES.md"), "notes content 2")
    const result = reconcileMemory(db, memoryDir)
    expect(result.indexed).toBe(2)
  })

  test("prunes rows for files that no longer exist", () => {
    const f1 = join(memoryDir, "MEMORY.md")
    writeFileSync(f1, "content 1")
    reconcileMemory(db, memoryDir)
    expect((db.query("SELECT COUNT(*) as c FROM memory_fts").get() as any).c).toBe(1)

    // Delete the file
    rmSync(f1)
    const result = reconcileMemory(db, memoryDir)
    expect(result.pruned).toBe(1)
    expect((db.query("SELECT COUNT(*) as c FROM memory_fts").get() as any).c).toBe(0)
  })
})
