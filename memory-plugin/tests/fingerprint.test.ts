import { describe, test, expect } from "bun:test"
import { fingerprint } from "../src/lib/fingerprint"

describe("fingerprint", () => {
  test("returns ${size}-${mtimeMs} format", () => {
    const fp = fingerprint({ size: 1234, mtimeMs: 1700000000000 })
    expect(fp).toBe("1234-1700000000000")
  })

  test("different size → different fingerprint", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 200, mtimeMs: 1000 })
    expect(a).not.toBe(b)
  })

  test("different mtime → different fingerprint", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 100, mtimeMs: 2000 })
    expect(a).not.toBe(b)
  })

  test("same input → same fingerprint (idempotent)", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 100, mtimeMs: 1000 })
    expect(a).toBe(b)
  })

  test("zero size is valid edge case", () => {
    const fp = fingerprint({ size: 0, mtimeMs: 0 })
    expect(fp).toBe("0-0")
  })
})
