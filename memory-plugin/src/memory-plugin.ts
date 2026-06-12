/**
 * v3 Long-term Memory Plugin for opencode 1.17.4
 *
 * Key v2→v3 changes (fixing TUI bootstrap failure):
 * - No I/O in plugin constructor (defer to hooks)
 * - Lazy-init Database on first hook invocation
 * - Uses data/memory-plugin.db (not data/memory.db, avoid bun:sqlite conflict)
 * - Uses generic `event` handler pattern (matches official plugin docs)
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
 * Explicitly passes migration dir because `import.meta.dir` differs between
 * source (src/lib/) and built (dist/) paths.
 */
function getDb(projectDir: string): Database {
  if (_db) return _db
  const dbPath = join(projectDir, "data", "memory-plugin.db")
  _db = new Database(dbPath)
  // Resolve migration dir from project root (works in both source and built contexts)
  const migrationDir = join(projectDir, "memory-plugin", "migration")
  migrate(_db, migrationDir)
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
  const project = (ctx as any).project
  const projectDir: string = project?.worktree ?? project?.directory ?? process.cwd()
  const cfg = project?.config?.memory ?? {}
  const enabled = cfg.enabled !== false

  if (!enabled) {
    return {}
  }

  // ---- HOOKS ----
  return {
    /** Generic event listener — session events work through this pattern per official docs */
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      try {
        if (event.type === "session.created") {
          const db = getDb(projectDir)
          const sessionID = (event as any).sessionID ?? "?"
          writeMarker(projectDir, "session.created", {
            sessionId: sessionID,
            dbOpen: db != null,
            tableCount: (db.query("SELECT count(*) as c FROM memory_fts").get() as any)?.c ?? 0,
          })
          console.log("[memory-plugin v3] session.created ✓")
        }

        if (event.type === "session.idle") {
          writeMarker(projectDir, "session.idle", {})
          console.log("[memory-plugin v3] session.idle ✓")
        }
      } catch (e) {
        console.error("[memory-plugin v3] event error:", e)
      }
    },
  }
}

export default MemoryPlugin
