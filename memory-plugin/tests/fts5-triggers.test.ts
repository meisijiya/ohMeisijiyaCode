import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("FTS5 triggers (integration)", () => {
  let db: Database
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fts5-triggers-"))
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("INSERT into memory_fts adds to memory_fts_idx", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p1", "memory", "alpha bravo charlie", "1-1", Date.now())
    const hits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("bravo") as any[]
    expect(hits.length).toBe(1)
  })

  test("UPDATE body updates FTS5 index (no stale tokens)", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p2", "memory", "old content here", "1-1", Date.now())
    db.query("UPDATE memory_fts SET body = ?, fingerprint = ? WHERE path = ?").run(
      "completely different text",
      "2-2",
      "/p2",
    )
    // Old token 'here' should NOT match anymore
    const oldHits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("here") as any[]
    expect(oldHits.length).toBe(0)
    // New token should match
    const newHits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("completely") as any[]
    expect(newHits.length).toBe(1)
  })

  test("DELETE removes from FTS5 index (no orphan tokens)", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p3", "memory", "delete me please", "1-1", Date.now())
    db.query("DELETE FROM memory_fts WHERE path = ?").run("/p3")
    const hits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("delete") as any[]
    expect(hits.length).toBe(0)
  })
})
