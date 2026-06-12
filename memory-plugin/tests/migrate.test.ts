import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("migrate", () => {
  let db: Database
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "migrate-test-"))
    db = new Database(join(tmpDir, "test.db"))
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("creates memory_fts table on fresh db", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts'").all() as any[]
    expect(tables.length).toBe(1)
  })

  test("creates memory_fts_idx virtual table", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts_idx'").all() as any[]
    expect(tables.length).toBe(1)
  })

  test("creates 3 triggers (ai, ad, au)", () => {
    migrate(db)
    const triggers = db.query("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'memory_fts_%'").all() as any[]
    expect(triggers.map((t: any) => t.name).sort()).toEqual([
      "memory_fts_ad",
      "memory_fts_ai",
      "memory_fts_au",
    ])
  })

  test("creates memory_search_log and memory_reconcile_state", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[]
    const names = tables.map((t: any) => t.name)
    expect(names).toContain("memory_search_log")
    expect(names).toContain("memory_reconcile_state")
  })

  test("idempotent: running migrate twice does not error", () => {
    migrate(db)
    expect(() => migrate(db)).not.toThrow()
  })
})
