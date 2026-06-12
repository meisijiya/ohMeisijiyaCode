import { describe, test, expect } from "bun:test"
import { parseMemory, renderEntry, type Section, type MemoryEntry } from "../src/lib/memory-parse"

const SAMPLE = `# Project Memory

## Project context

OpenCode-based multi-agent harness for v2 long-term memory.

## Rules

- Use Bun.file() over fs.readFile
- No try/catch — early return

## Architecture decisions

- 2026-06-12: SQLite FTS5 over .md grep (CJK support)

## Discovered durable knowledge

- task-dispatch default background:true (commit fa95a0a)
`

describe("parseMemory", () => {
  test("parses 4 sections in order", () => {
    const result = parseMemory(SAMPLE)
    expect(Object.keys(result.sections)).toEqual([
      "Project context",
      "Rules",
      "Architecture decisions",
      "Discovered durable knowledge",
    ])
  })

  test("captures each section's body text", () => {
    const result = parseMemory(SAMPLE)
    expect(result.sections["Rules"]).toContain("Use Bun.file()")
    expect(result.sections["Architecture decisions"]).toContain("SQLite FTS5")
  })

  test("returns empty sections when missing", () => {
    const result = parseMemory("# Project Memory\n\n## Project context\n\nOnly one section.\n")
    expect(result.sections["Project context"]).toContain("Only one section")
    expect(result.sections["Rules"]).toBe("")
  })

  test("throws on missing # Project Memory header", () => {
    expect(() => parseMemory("## Project context\n\nNo header\n")).toThrow(/missing.*Project Memory/i)
  })

  test("throws on empty input", () => {
    expect(() => parseMemory("")).toThrow()
  })

  test("flattens to entries with type and body", () => {
    const result = parseMemory(SAMPLE)
    const entries = result.entries
    expect(entries.length).toBeGreaterThanOrEqual(4)
    const types = entries.map((e) => e.type)
    expect(types).toContain("context")
    expect(types).toContain("rules")
    expect(types).toContain("architecture")
    expect(types).toContain("discovered")
  })
})

describe("renderEntry", () => {
  test("renders as bullet with section prefix", () => {
    const e: MemoryEntry = {
      type: "rules",
      section: "Rules",
      body: "- Use Bun.file() over fs.readFile",
    }
    expect(renderEntry(e)).toBe("- [Rules] Use Bun.file() over fs.readFile")
  })
})
