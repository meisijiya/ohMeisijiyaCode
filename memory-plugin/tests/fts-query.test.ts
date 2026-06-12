import { describe, test, expect } from "bun:test"
import { buildFtsQuery } from "../src/lib/fts-query"

describe("buildFtsQuery", () => {
  test("empty string returns null", () => {
    expect(buildFtsQuery("")).toBeNull()
  })

  test("whitespace-only returns null", () => {
    expect(buildFtsQuery("   \t  ")).toBeNull()
  })

  test("single token is phrase-quoted", () => {
    expect(buildFtsQuery("keyword")).toBe('"keyword"')
  })

  test("multiple tokens OR-joined and phrase-quoted", () => {
    expect(buildFtsQuery("keyword trigger why")).toBe('"keyword" OR "trigger" OR "why"')
  })

  test("CJK characters tokenized correctly", () => {
    // 为什么 — should tokenize to single CJK token
    const result = buildFtsQuery("为什么选择")
    expect(result).toBe('"为什么选择"')
  })

  test("CJK + Latin mixed", () => {
    const result = buildFtsQuery("为什么 keyword 方案")
    expect(result).toBe('"为什么" OR "keyword" OR "方案"')
  })

  test("punctuation stripped during tokenization", () => {
    // postgres://host:5433 → postgres, host, 5433
    const result = buildFtsQuery("postgres://host:5433")
    expect(result).toBe('"postgres" OR "host" OR "5433"')
  })

  test("FTS5 special chars escaped via phrase quotes", () => {
    // Raw: "test* (foo) -bar" — without phrase quotes would crash FTS5
    const result = buildFtsQuery('test* (foo) -bar')
    // Tokens: test, foo, bar (punctuation stripped, * and - are separators)
    expect(result).toBe('"test" OR "foo" OR "bar"')
  })

  test("embedded double quotes are stripped", () => {
    // User input with quotes — must not break the phrase-quoting
    const result = buildFtsQuery('say "hello"')
    expect(result).toBe('"say" OR "hello"')
  })

  test("underscore preserved in token", () => {
    const result = buildFtsQuery("task_id T5_3")
    expect(result).toBe('"task_id" OR "T5_3"')
  })

  test("long query (>200 chars) still builds", () => {
    const long = "a".repeat(300)
    const result = buildFtsQuery(long)
    expect(result).toBe(`"${"a".repeat(300)}"`)
  })

  test("numbers-only token", () => {
    expect(buildFtsQuery("5433")).toBe('"5433"')
  })
})
