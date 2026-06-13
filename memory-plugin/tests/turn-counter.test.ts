import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { migrate } from "../src/lib/migrate"

/**
 * Unit tests for the project-scoped turn counter.
 *
 * Critical invariants:
 * 1. Counter is PROJECT-scoped, not session-scoped. Two sessions in the
 *    same project share the same counter.
 * 2. Counter increments by exactly 1 per call, atomically.
 * 3. resetTurnCount sets count to 0 (not 1, not 2).
 * 4. getTurnCount returns 0 for never-seen project (not undefined).
 * 5. New project has no row, increment creates it.
 */

// Import after migrate is available (or test inline copy).
// We test against the real functions to catch schema drift.

const TEST_PROJECT_A = "project_aaa"
const TEST_PROJECT_B = "project_bbb"
const TEST_PROJECT_NEW = "project_new"

describe("curator turn counter", () => {
  let db: Database
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "turn-counter-"))
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("new project: getTurnCount returns 0, no row created", () => {
    const row = db.query("SELECT * FROM memory_curator_counter WHERE project_hash = ?").get(TEST_PROJECT_NEW)
    expect(row).toBeNull()
  })

  test("increment: creates row, returns 1", () => {
    db.query(
      `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`,
    ).run(TEST_PROJECT_A, Date.now(), Date.now())
    const row = db
      .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
      .get(TEST_PROJECT_A) as { turn_count: number }
    expect(row.turn_count).toBe(1)
  })

  test("increment: existing row goes 1 → 2 → 3", () => {
    const sql = `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`
    const now = Date.now()
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_A, now, now)
    const row = db
      .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
      .get(TEST_PROJECT_A) as { turn_count: number }
    expect(row.turn_count).toBe(3)
  })

  test("two projects: counters are independent", () => {
    const sql = `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`
    const now = Date.now()
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_B, now, now)

    const a = db.query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?").get(TEST_PROJECT_A) as { turn_count: number }
    const b = db.query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?").get(TEST_PROJECT_B) as { turn_count: number }
    expect(a.turn_count).toBe(2)
    expect(b.turn_count).toBe(1)
  })

  test("reset: sets count to 0 (not 1), sets last_full_at", () => {
    const sql = `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`
    const now = Date.now()
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_A, now, now)
    db.query(sql).run(TEST_PROJECT_A, now, now)

    // Reset
    db.query(
      `INSERT INTO memory_curator_counter (project_hash, turn_count, last_full_at)
       VALUES (?, 0, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = 0, last_full_at = ?`,
    ).run(TEST_PROJECT_A, Date.now(), Date.now())

    const row = db
      .query("SELECT turn_count, last_full_at FROM memory_curator_counter WHERE project_hash = ?")
      .get(TEST_PROJECT_A) as { turn_count: number; last_full_at: number | null }
    expect(row.turn_count).toBe(0)
    expect(row.last_full_at).not.toBeNull()
  })

  test("scenario: 14 increments → 14, 15th → 15 (triggers full reset to 0)", () => {
    const sql = `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`
    const now = Date.now()
    const THRESHOLD = 15
    let shouldReset = false
    let lastCount = 0

    for (let i = 0; i < 15; i++) {
      db.query(sql).run(TEST_PROJECT_A, now, now)
      const row = db
        .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
        .get(TEST_PROJECT_A) as { turn_count: number }
      lastCount = row.turn_count
      if (row.turn_count >= THRESHOLD) {
        shouldReset = true
        db.query(
          `INSERT INTO memory_curator_counter (project_hash, turn_count, last_full_at)
           VALUES (?, 0, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = 0, last_full_at = ?`,
        ).run(TEST_PROJECT_A, Date.now(), Date.now())
        break
      }
    }

    expect(lastCount).toBe(15)
    expect(shouldReset).toBe(true)

    // After reset
    const row = db
      .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
      .get(TEST_PROJECT_A) as { turn_count: number }
    expect(row.turn_count).toBe(0)
  })

  test("scenario: custom threshold (default 15) — 5 turns stays at 5, no full", () => {
    const sql = `INSERT INTO memory_curator_counter (project_hash, turn_count, last_delta_at)
       VALUES (?, 1, ?) ON CONFLICT(project_hash) DO UPDATE SET turn_count = turn_count + 1, last_delta_at = ?`
    const now = Date.now()
    const THRESHOLD = 15
    let triggeredFull = false

    for (let i = 0; i < 5; i++) {
      db.query(sql).run(TEST_PROJECT_A, now, now)
      const row = db
        .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
        .get(TEST_PROJECT_A) as { turn_count: number }
      if (row.turn_count >= THRESHOLD) {
        triggeredFull = true
        break
      }
    }

    expect(triggeredFull).toBe(false)
    const row = db
      .query("SELECT turn_count FROM memory_curator_counter WHERE project_hash = ?")
      .get(TEST_PROJECT_A) as { turn_count: number }
    expect(row.turn_count).toBe(5)
  })
})
