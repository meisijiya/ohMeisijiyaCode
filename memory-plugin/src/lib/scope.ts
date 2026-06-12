import { createHash } from "crypto"
import { join } from "path"

export type Scope = "projects"

export type MemoryType = "context" | "rules" | "architecture" | "discovered" | "memory"

export interface MemoryLocator {
  scope: Scope
  scope_id: string
  type: MemoryType
  key: string
}

const MEMORY_PATH_RE = /\/memory\/projects\/([^/]+)\/(.+)\.md$/

/**
 * Parse an absolute path into a MemoryLocator.
 * Returns null if path does not match the memory layout.
 */
export function parsePath(absPath: string): MemoryLocator | null {
  const m = absPath.match(MEMORY_PATH_RE)
  if (!m) return null
  const [, scope_id, keyRaw] = m
  return { scope: "projects", scope_id, type: "memory", key: keyRaw }
}

/**
 * Build an absolute path from a MemoryLocator.
 * Rejects path traversal attempts in scope_id or key.
 */
export function buildPath(input: {
  root: string
  scope: Scope
  scope_id?: string
  key: string
}): string {
  if (input.scope_id !== undefined) assertSafeComponent(input.scope_id)
  assertSafeComponent(input.key)
  const parts = [input.root, input.scope]
  parts.push(input.scope_id ?? "")
  parts.push(`${input.key}.md`)
  return join(...parts)
}

/**
 * Resolve a project_id from the absolute repo path.
 * Uses sha256 prefix (12 hex chars) for stability across machines.
 */
export function resolveProjectId(absRepoPath: string): string {
  return createHash("sha256").update(absRepoPath).digest("hex").slice(0, 12)
}

/**
 * Reject any segment containing '..' or starting with '/'.
 * Guards against path traversal and absolute-path injection.
 */
export function assertSafeComponent(value: string): void {
  for (const segment of value.split("/")) {
    if (segment === "..") throw new Error(`buildPath: invalid path component: ${value}`)
  }
  if (value.startsWith("/")) throw new Error(`buildPath: invalid path component: ${value}`)
}
