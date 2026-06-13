import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

/**
 * Unit tests for the JSON-based project-scoped turn counter.
 *
 * v3.2: counter is data/memory/counter.json, no SQLite.
 *
 * Critical invariants:
 * 1. Counter is PROJECT-scoped (key = 12-char sha256 prefix of project path).
 * 2. Two sessions in the same project share the same counter.
 * 3. incrementTurnCount is atomic via read-modify-write (single-process plugin).
 * 4. resetTurnCount sets count to 0 and stamps lastFullAt.
 * 5. Threshold logic: count >= triggerThreshold → reset + dispatch.
 * 6. Corrupted counter.json is handled gracefully (reset to empty).
 */

const PROJECT_A = "project_aaa"
const PROJECT_B = "project_bbb"
const PROJECT_NEW = "project_zzz"

// Mirrors the counter logic in memory-plugin.ts. Keep in sync.
interface CounterEntry {
  turnCount: number
  lastFullAt: number | null
  lastDeltaAt: number | null
}
type CounterFile = Record<string, CounterEntry>

function counterPath(projectDir: string): string {
  return join(projectDir, "counter.json")
}

function readCounter(projectDir: string): CounterFile {
  const p = counterPath(projectDir)
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, "utf-8"))
  } catch {
    return {}
  }
}

function writeCounter(projectDir: string, counter: CounterFile): void {
  const { writeFileSync, mkdirSync } = require("fs") as typeof import("fs")
  const p = counterPath(projectDir)
  mkdirSync(join(p, ".."), { recursive: true })
  writeFileSync(p, JSON.stringify(counter, null, 2) + "\n")
}

function incrementTurnCount(projectDir: string, projectHash: string): number {
  const counter = readCounter(projectDir)
  const entry = counter[projectHash] ?? { turnCount: 0, lastFullAt: null, lastDeltaAt: null }
  entry.turnCount += 1
  entry.lastDeltaAt = Date.now()
  counter[projectHash] = entry
  writeCounter(projectDir, counter)
  return entry.turnCount
}

function resetTurnCount(projectDir: string, projectHash: string): void {
  const counter = readCounter(projectDir)
  const entry = counter[projectHash] ?? { turnCount: 0, lastFullAt: null, lastDeltaAt: null }
  entry.turnCount = 0
  entry.lastFullAt = Date.now()
  counter[projectHash] = entry
  writeCounter(projectDir, counter)
}

describe("turn counter (JSON file)", () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "counter-"))
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
  })

  test("new project: no file exists, readCounter returns empty", () => {
    expect(existsSync(counterPath(projectDir))).toBe(false)
    expect(readCounter(projectDir)).toEqual({})
  })

  test("increment: creates file, returns 1", () => {
    const n = incrementTurnCount(projectDir, PROJECT_NEW)
    expect(n).toBe(1)
    const counter = readCounter(projectDir)
    expect(counter[PROJECT_NEW].turnCount).toBe(1)
    expect(counter[PROJECT_NEW].lastDeltaAt).toBeGreaterThan(0)
    expect(counter[PROJECT_NEW].lastFullAt).toBeNull()
  })

  test("increment: 1 → 2 → 3 (existing row updates)", () => {
    incrementTurnCount(projectDir, PROJECT_A)
    incrementTurnCount(projectDir, PROJECT_A)
    expect(incrementTurnCount(projectDir, PROJECT_A)).toBe(3)
  })

  test("two projects: counters are independent", () => {
    incrementTurnCount(projectDir, PROJECT_A)
    incrementTurnCount(projectDir, PROJECT_A)
    incrementTurnCount(projectDir, PROJECT_B)
    expect(readCounter(projectDir)[PROJECT_A].turnCount).toBe(2)
    expect(readCounter(projectDir)[PROJECT_B].turnCount).toBe(1)
  })

  test("reset: sets count to 0, stamps lastFullAt", () => {
    incrementTurnCount(projectDir, PROJECT_A)
    incrementTurnCount(projectDir, PROJECT_A)
    incrementTurnCount(projectDir, PROJECT_A)
    resetTurnCount(projectDir, PROJECT_A)
    const entry = readCounter(projectDir)[PROJECT_A]
    expect(entry.turnCount).toBe(0)
    expect(entry.lastFullAt).toBeGreaterThan(0)
  })

  test("threshold: 14 turns stays, 15th triggers reset", () => {
    const THRESHOLD = 15
    let didDispatch = false
    for (let i = 0; i < 15; i++) {
      const n = incrementTurnCount(projectDir, PROJECT_A)
      if (n >= THRESHOLD) {
        resetTurnCount(projectDir, PROJECT_A)
        didDispatch = true
        break
      }
    }
    expect(didDispatch).toBe(true)
    expect(readCounter(projectDir)[PROJECT_A].turnCount).toBe(0)
  })

  test("custom threshold (5): 5 turns triggers reset", () => {
    const THRESHOLD = 5
    let didDispatch = false
    for (let i = 0; i < 5; i++) {
      const n = incrementTurnCount(projectDir, PROJECT_A)
      if (n >= THRESHOLD) {
        resetTurnCount(projectDir, PROJECT_A)
        didDispatch = true
        break
      }
    }
    expect(didDispatch).toBe(true)
    expect(readCounter(projectDir)[PROJECT_A].turnCount).toBe(0)
  })

  test("custom threshold (5): only 4 turns → no dispatch", () => {
    const THRESHOLD = 5
    let didDispatch = false
    for (let i = 0; i < 4; i++) {
      const n = incrementTurnCount(projectDir, PROJECT_A)
      if (n >= THRESHOLD) {
        didDispatch = true
        break
      }
    }
    expect(didDispatch).toBe(false)
    expect(readCounter(projectDir)[PROJECT_A].turnCount).toBe(4)
  })

  test("corrupted counter.json: readCounter returns empty, next write recovers", () => {
    const { writeFileSync } = require("fs") as typeof import("fs")
    writeFileSync(counterPath(projectDir), "{ not valid json }")
    expect(readCounter(projectDir)).toEqual({})
    // Next increment should work and overwrite the corrupt file
    incrementTurnCount(projectDir, PROJECT_A)
    const counter = readCounter(projectDir)
    expect(counter[PROJECT_A].turnCount).toBe(1)
  })

  test("session-scoped isolation: same hash, different tmpDir = independent counters", () => {
    const projectDir2 = mkdtempSync(join(tmpdir(), "counter-"))
    try {
      incrementTurnCount(projectDir, PROJECT_A)
      incrementTurnCount(projectDir, PROJECT_A)
      incrementTurnCount(projectDir2, PROJECT_A)
      expect(readCounter(projectDir)[PROJECT_A].turnCount).toBe(2)
      expect(readCounter(projectDir2)[PROJECT_A].turnCount).toBe(1)
    } finally {
      rmSync(projectDir2, { recursive: true, force: true })
    }
  })
})
