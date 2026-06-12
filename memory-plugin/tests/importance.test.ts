import { describe, test, expect } from "bun:test"
import { score, ageDecay, selectTopN, type Entry } from "../src/lib/importance"

describe("ageDecay", () => {
  test("0-6 days: 1.0", () => {
    expect(ageDecay(0)).toBe(1.0)
    expect(ageDecay(6)).toBe(1.0)
  })
  test("7-29 days: 0.9", () => {
    expect(ageDecay(7)).toBe(0.9)
    expect(ageDecay(29)).toBe(0.9)
  })
  test("30-89 days: 0.7", () => {
    expect(ageDecay(30)).toBe(0.7)
    expect(ageDecay(89)).toBe(0.7)
  })
  test("90-179 days: 0.5", () => {
    expect(ageDecay(90)).toBe(0.5)
    expect(ageDecay(179)).toBe(0.5)
  })
  test("180+ days: 0.3", () => {
    expect(ageDecay(180)).toBe(0.3)
    expect(ageDecay(1000)).toBe(0.3)
  })
})

describe("score", () => {
  test("weight × age × log(hit) formula", () => {
    // weight=10, age=0 (1.0), hit=10 → 10 * 1.0 * (1 + ln(11)) = 10 * 1.0 * 3.46 = 34.6
    const s = score({ type: "rules", ageDays: 0, hitCount: 10 })
    expect(s).toBeCloseTo(10 * 1.0 * (1 + Math.log(11)), 2)
  })

  test("hitCount=0 case: 1 + log(1) = 1.0", () => {
    const s = score({ type: "rules", ageDays: 0, hitCount: 0 })
    expect(s).toBeCloseTo(10 * 1.0 * (1 + Math.log(1)), 2) // log(1) = 0
  })

  test("old age (180+ days) heavily downweighted", () => {
    const recent = score({ type: "rules", ageDays: 1, hitCount: 0 })
    const old = score({ type: "rules", ageDays: 365, hitCount: 0 })
    expect(recent / old).toBeGreaterThan(3) // 1.0 / 0.3 ≈ 3.3
  })

  test("rules > architecture > discovered > context (weight ordering)", () => {
    const rules = score({ type: "rules", ageDays: 0, hitCount: 0 })
    const arch = score({ type: "architecture", ageDays: 0, hitCount: 0 })
    const disc = score({ type: "discovered", ageDays: 0, hitCount: 0 })
    const ctx = score({ type: "context", ageDays: 0, hitCount: 0 })
    expect(rules).toBeGreaterThan(arch)
    expect(arch).toBeGreaterThan(disc)
    expect(disc).toBeGreaterThan(ctx)
  })
})

describe("selectTopN", () => {
  const entries: Entry[] = [
    { id: 1, type: "context", body: "Project: long-term memory v2 system", ageDays: 0, hitCount: 0 },
    { id: 2, type: "rules", body: "Always use Bun.file() over fs.readFile for .md reads", ageDays: 1, hitCount: 5 },
    { id: 3, type: "architecture", body: "SQLite FTS5 over .md grep because unicode61 supports CJK", ageDays: 0, hitCount: 0 },
    { id: 4, type: "discovered", body: "Bun's index.d.ts has no native tail-N function", ageDays: 30, hitCount: 0 },
  ]

  test("returns entries sorted by score DESC", () => {
    const top = selectTopN(entries, 10000)
    expect(top[0].id).toBe(2) // rules + 1 hit = highest
    // 3 (architecture, fresh) > 4 (discovered, 30d old) > 1 (context, lowest weight)
  })

  test("respects budgetTokens (drops lowest-score if overflow)", () => {
    const top = selectTopN(entries, 30) // very small budget
    // Only the highest-scored entry fits
    expect(top.length).toBeLessThan(entries.length)
    expect(top[0].id).toBe(2)
  })

  test("empty entries returns empty", () => {
    expect(selectTopN([], 1000)).toEqual([])
  })
})
