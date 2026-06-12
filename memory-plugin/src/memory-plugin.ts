/**
 * v3 Long-term Memory Plugin for opencode 1.17.4
 *
 * Key v2→v3 changes (fixing TUI bootstrap failure):
 * - No I/O in plugin constructor (defer to hooks)
 * - Lazy-init Database on first hook invocation
 * - Uses data/memory-plugin.db (not data/memory.db, avoid bun:sqlite conflict)
 * - Starts with minimal session.created hook; other hooks added incrementally
 *
 * Reference: docs/superpowers/specs/2026-06-12-v2-test-pitfalls.md
 */
import type { Plugin } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { migrate } from "./lib/migrate"

// ---- Lazy state: only touched on first hook invocation ----
let _db: Database | null = null

/**
 * Lazy-init the SQLite database.
 * Only called on first hook invocation, never in plugin constructor.
 */
function getDb(projectDir: string): Database {
  if (_db) return _db
  const dbPath = join(projectDir, "data", "memory-plugin.db")
  _db = new Database(dbPath)
  migrate(_db)
  return _db
}

/**
 * Write a diagnostic marker file so we can verify the plugin loaded correctly.
 * Best-effort; never throws.
 */
function writeMarker(projectDir: string, hook: string, details?: Record<string, unknown>): void {
  try {
    const markerDir = join(projectDir, "data", "memory")
    if (!existsSync(markerDir)) {
      mkdirSync(markerDir, { recursive: true })
    }
    const ts = Date.now()
    const payload = {
      plugin: "v3-long-term-memory",
      hook,
      ts,
      projectDir,
      ...details,
    }
    writeFileSync(
      join(markerDir, `.hook-${hook}-${ts}`),
      JSON.stringify(payload, null, 2) + "\n",
    )
  } catch {
    // Best-effort diagnostics; never let marker failure propagate
  }
}

export const MemoryPlugin: Plugin = async (ctx) => {
  // ---- CONSTRUCTOR: ZERO I/O ----
  // Only read config and stash context. No fs, no DB, no network.
  const project = (ctx as any).project
  const projectDir: string = project?.worktree ?? project?.directory ?? process.cwd()
  const cfg = project?.config?.memory ?? {}
  const enabled = cfg.enabled !== false // enabled by default

  if (!enabled) {
    return {}
  }

  // ---- HOOKS ----
  return {
    /**
     * session.created: diagnostic-only hook for v3.
     * Writes a marker file to verify plugin is alive and TUI works.
     * Will be expanded in v3.1+ to inject top-N memory into system_prompt.
     */
    "session.created": async (input: any) => {
      try {
        const db = getDb(projectDir)
        writeMarker(projectDir, "session.created", {
          sessionId: input?.sessionID ?? "?",
          dbOpen: db != null,
          tableCount: (db.query("SELECT count(*) as c FROM memory_fts").get() as any)?.c ?? 0,
        })
        console.log("[memory-plugin v3] session.created ✓")
      } catch (e) {
        console.error("[memory-plugin v3] session.created error:", e)
      }
    },

    /**
     * session.idle: fire-and-forget marker for v3.
     * Full curator dispatch to be added in v3.1+.
     */
    "session.idle": async () => {
      try {
        writeMarker(projectDir, "session.idle", {})
        console.log("[memory-plugin v3] session.idle ✓")
      } catch {
        // ignore
      }
    },
  }
}

export default MemoryPlugin
