/**
 * v3 Long-term Memory Plugin for opencode 1.17.4
 *
 * Architecture:
 * - No I/O in plugin constructor (fixes v2 TUI bootstrap failure)
 * - Lazy-init Database on first hook invocation
 * - Uses data/memory-plugin.db (not data/memory.db)
 * - All session events via generic `event` handler
 * - Memory injection via `experimental.session.compacting` hook
 *
 * Reference: docs/superpowers/specs/2026-06-12-v2-test-pitfalls.md
 */
import type { Plugin } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "fs"
import { join, dirname } from "path"
import { migrate } from "./lib/migrate"
import { parseMemory, renderEntry } from "./lib/memory-parse"
import { selectTopN, type Entry } from "./lib/importance"
import { resolveProjectId } from "./lib/scope"

// ---- Config ----
interface MemoryConfig {
  enabled: boolean
  root: string
  db: string
  injection: { budgetTokens: number }
}

const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  root: "data/memory",
  db: "data/memory-plugin.db",
  injection: { budgetTokens: 3000 },
}

// ---- Lazy state ----
let _db: Database | null = null
let _cfg: MemoryConfig | null = null

function getConfig(project: any): MemoryConfig {
  if (_cfg) return _cfg
  const fromJson = project?.config?.memory ?? {}
  _cfg = { ...DEFAULT_CONFIG, ...fromJson }
  return _cfg
}

function getDb(projectDir: string): Database {
  if (_db) return _db
  const cfg = getConfig(null!)
  const dbPath = join(projectDir, cfg.db)
  _db = new Database(dbPath)
  const migrationDir = join(projectDir, "memory-plugin", "migration")
  migrate(_db, migrationDir)
  return _db
}

function memoryDir(cfg: MemoryConfig, projectDir: string): string {
  return join(projectDir, cfg.root, "projects", resolveProjectId(projectDir))
}

function ensureMemoryMd(memoryDir: string): string {
  const mdPath = join(memoryDir, "MEMORY.md")
  if (!existsSync(mdPath)) {
    mkdirSync(memoryDir, { recursive: true })
    const template = [
      "# Project Memory",
      "",
      "## Project context",
      "",
      "## Rules",
      "",
      "## Architecture decisions",
      "",
      "## Discovered durable knowledge",
      "",
    ].join("\n")
    writeFileSync(mdPath, template)
  }
  return mdPath
}

function appendToQueue(cfg: MemoryConfig, projectDir: string, sessionId: string, messageId: string, text: string): void {
  if (!text.trim()) return
  const queuePath = join(projectDir, cfg.root, "queue.jsonl")
  const dir = dirname(queuePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (existsSync(queuePath)) {
    const lines = readFileSync(queuePath, "utf-8").split("\n").filter(Boolean)
    if (lines.some((l) => l.includes(`"message_id":"${messageId}"`))) return
  }
  const entry = JSON.stringify({ session_id: sessionId, message_id: messageId, part_text: text, time: Date.now() })
  appendFileSync(queuePath, entry + "\n")
}

function writeMarker(projectDir: string, hook: string, details?: Record<string, unknown>): void {
  try {
    const markerDir = join(projectDir, "data", "memory")
    if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true })
    writeFileSync(
      join(markerDir, `.hook-${hook}-${Date.now()}`),
      JSON.stringify({ plugin: "v3-long-term-memory", hook, ts: Date.now(), projectDir, ...details }, null, 2) + "\n",
    )
  } catch { /* best-effort */ }
}

function buildInjectionBlock(cfg: MemoryConfig, projectDir: string): string {
  const mDir = memoryDir(cfg, projectDir)
  const mdPath = join(mDir, "MEMORY.md")
  if (!existsSync(mdPath)) return ""
  const body = readFileSync(mdPath, "utf-8")
  const parsed = parseMemory(body)
  const entries: Entry[] = parsed.entries.map((e, i) => ({
    id: i, type: e.type, body: renderEntry(e), ageDays: 0, hitCount: 0,
  }))
  const top = selectTopN(entries, cfg.injection.budgetTokens)
  if (top.length === 0) return ""
  return `## 📚 Project Memory (auto-injected)\n\n${top.map((e) => e.body).join("\n")}\n\n---`
}

// ---- Plugin ----
export const MemoryPlugin: Plugin = async (ctx) => {
  // CONSTRUCTOR: ZERO I/O
  const project = (ctx as any).project
  const projectDir: string = project?.worktree ?? project?.directory ?? process.cwd()
  const cfg = getConfig(project)
  if (!cfg.enabled) return {}

  return {
    /**
     * experimental.session.compacting: inject project memory into compaction context.
     * Uses named hook pattern because we need to modify `output.context`.
     */
    "experimental.session.compacting": async (input: any, output: any) => {
      try {
        const block = buildInjectionBlock(cfg, projectDir)
        if (block && output?.context) {
          output.context.push(block)
          console.log("[memory-plugin v3] compacting: injected memory block")
        }
      } catch (e) {
        console.error("[memory-plugin v3] compacting error:", e)
      }
    },

    /**
     * Generic event handler: all session lifecycle events.
     */
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      try {
        if (event.type === "session.created") {
          getDb(projectDir)  // lazy-init DB
          const mDir = memoryDir(cfg, projectDir)
          ensureMemoryMd(mDir)  // ensure MEMORY.md exists
          writeMarker(projectDir, "session.created", {
            sessionId: (event as any).sessionID ?? "?",
          })
          console.log("[memory-plugin v3] session.created ✓")
        }

        if (event.type === "message.updated") {
          const ev = event as any
          if (ev.message?.role !== "assistant") return
          const textPart = (ev.message.parts ?? []).find((p: any) => p.type === "text" && p.text)
          if (!textPart) return
          appendToQueue(cfg, projectDir, ev.sessionID ?? "?", ev.message.id, textPart.text)
        }

        if (event.type === "session.idle") {
          writeMarker(projectDir, "session.idle", {})
          console.log("[memory-plugin v3] session.idle ✓")
        }

        if (event.type === "session.compacted") {
          writeMarker(projectDir, "session.compacted", {})
          console.log("[memory-plugin v3] session.compacted ✓")
        }
      } catch (e) {
        console.error("[memory-plugin v3] event error:", e)
      }
    },
  }
}

export default MemoryPlugin
