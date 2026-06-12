/**
 * v3 Long-term Memory Plugin for opencode 1.17.4
 *
 * Architecture:
 * - No I/O in plugin constructor (fixes v2 TUI bootstrap failure)
 * - Lazy-init Database on first hook invocation
 * - Uses data/memory-plugin.db (not data/memory.db)
 * - Structured logging via client.app.log() (persistent, survives restart)
 * - Marker files auto-cleaned (keeps last 20)
 * - Disable per-project: {"memory": {"enabled": false}} in .opencode/opencode.json
 *
 * Reference: docs/superpowers/specs/2026-06-12-v2-test-pitfalls.md
 */
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, readdirSync, unlinkSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { migrate } from "./lib/migrate"
import { parseMemory, renderEntry } from "./lib/memory-parse"
import { selectTopN, type Entry } from "./lib/importance"
import { resolveProjectId } from "./lib/scope"
import { searchMemory, formatSearchResults, type SearchArgs } from "./memory"

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
let _client: any = null  // opencode SDK client for structured logging

function getConfig(project: any): MemoryConfig {
  if (_cfg) return _cfg
  const fromJson = project?.config?.memory ?? {}
  _cfg = { ...DEFAULT_CONFIG, ...fromJson }
  return _cfg
}

// ---- Structured logging ----
type LogLevel = "debug" | "info" | "warn" | "error"

/** Write to opencode's persistent log. Falls back to console if client unavailable. */
function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const tagged = `[memory-plugin] ${message}`
  if (_client?.app?.log) {
    _client.app.log({ body: { service: "memory-plugin", level, message: tagged, ...(extra ? { extra } : {}) } }).catch(() => {})
  }
  if (level === "error") console.error(`[memory-plugin v3] ${message}`)
}

// ---- Data helpers ----

function getDb(projectDir: string): Database {
  if (_db) return _db
  const cfg = getConfig(null!)
  const dbPath = join(projectDir, cfg.db)
  const dbDir = dirname(dbPath)
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
  _db = new Database(dbPath)
  const pluginDir = dirname(fileURLToPath(import.meta.url))
  const migrationDir = join(pluginDir, "..", "migration")
  migrate(_db, migrationDir)
  log("info", "DB initialized", { dbPath, tables: 10 })
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
    log("info", "MEMORY.md created", { path: mdPath })
  }
  return mdPath
}

function appendToQueue(cfg: MemoryConfig, projectDir: string, sessionId: string, messageId: string, text: string): void {
  if (!text.trim()) return
  try {
    const queuePath = join(projectDir, cfg.root, "queue.jsonl")
    const dir = dirname(queuePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const entry = JSON.stringify({ session_id: sessionId, message_id: messageId, part_text: text, time: Date.now() })
    appendFileSync(queuePath, entry + "\n")
  } catch (e) {
    log("error", "appendToQueue failed", { sessionId, messageId, error: (e as Error).message })
  }
}

/** Write diagnostic marker. Keep last 20, auto-clean older ones. */
function writeMarker(projectDir: string, hook: string, details?: Record<string, unknown>): void {
  try {
    const markerDir = join(projectDir, "data", "memory")
    if (!existsSync(markerDir)) mkdirSync(markerDir, { recursive: true })
    writeFileSync(
      join(markerDir, `.hook-${hook}-${Date.now()}`),
      JSON.stringify({ plugin: "v3-long-term-memory", hook, ts: Date.now(), projectDir, ...details }, null, 2) + "\n",
    )
    // Cleanup: keep last 20 markers, delete oldest
    const prefix = ".hook-"
    const files = readdirSync(markerDir)
      .filter((f) => f.startsWith(prefix))
      .sort()  // ascending by timestamp (lexicographic = chronological for ISO timestamps)
    while (files.length > 20) {
      const oldest = files.shift()!
      try { unlinkSync(join(markerDir, oldest)) } catch { /* best-effort */ }
    }
  } catch { /* best-effort diagnostics */ }
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
  // ctx.directory first: it's always the project dir. ctx.worktree may be "/" for non-git dirs.
  const projectDir: string = (ctx as any).directory ?? (ctx as any).worktree ?? process.cwd()
  const cfg = getConfig((ctx as any).project)
  _client = (ctx as any).client  // capture for structured logging

  if (!cfg.enabled) {
    return {}  // Plugin disabled per-project via {"memory": {"enabled": false}}
  }

  log("info", "plugin loaded", { projectDir, injectionBudget: cfg.injection.budgetTokens })

  return {
    /**
     * experimental.session.compacting: inject project memory into compaction context.
     */
    "experimental.session.compacting": async (input: any, output: any) => {
      try {
        const block = buildInjectionBlock(cfg, projectDir)
        if (block && output?.context) {
          output.context.push(block)
          log("debug", "memory injected into compaction", { blockChars: block.length })
        }
      } catch (e) {
        log("error", "compaction hook failed", { error: (e as Error).message })
      }
    },

    /**
     * /dream command: force full curator reconcile.
     */
    "tui.command.execute": async (input: any) => {
      try {
        if (input?.command !== "/dream") return
        getDb(projectDir)
        writeMarker(projectDir, "dream", { triggeredBy: input?.sessionID ?? "?" })
        log("info", "/dream triggered")

        const { client } = ctx as any
        if (client?.tool?.invoke) {
          await client.tool.invoke("task-dispatch", {
            subagent_type: "lyra",
            description: "memory curator full reconcile",
            prompt: [
              `/dream triggered by user.`,
              `Project directory: ${projectDir}`,
              `Force full reconcile — walk all sessions, verify each candidate against trajectory, no incremental optimization.`,
              `Read data/memory/queue.jsonl for recent content.`,
              `Read data/memory/projects/*/MEMORY.md for current state.`,
              `Follow the 5-phase workflow defined in memory-plugin/agents/memory-curator.md.`,
            ].join("\n"),
            background: true,
          } as any).catch(() => {})
        }

        return { output: "✓ /dream: curator dispatched (background)." }
      } catch (e) {
        log("error", "/dream hook failed", { error: (e as Error).message })
        return { output: `✗ /dream failed: ${(e as Error).message}` }
      }
    },

    /**
     * Generic event handler: all session lifecycle events.
     */
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      try {
        if (event.type === "session.created") {
          getDb(projectDir)
          const mDir = memoryDir(cfg, projectDir)
          ensureMemoryMd(mDir)
          writeMarker(projectDir, "session.created", {
            sessionId: (event as any).sessionID ?? "?",
          })
        }

        if (event.type === "message.updated") {
          // Metadata-only — text comes via message.part.updated
        }

        if (event.type === "message.part.updated") {
          const ev = event as any
          const props = ev.properties
          if (!props) return
          const part = props.part
          if (!part || part.type !== "text" || !part.text) return
          appendToQueue(cfg, projectDir, props.sessionID ?? "?", part.messageID ?? "?", part.text)
        }

        if (event.type === "session.idle") {
          writeMarker(projectDir, "session.idle", {})
        }

        if (event.type === "session.compacted") {
          writeMarker(projectDir, "session.compacted", {})
        }
      } catch (e) {
        log("error", "event handler failed", { eventType: event.type, error: (e as Error).message })
      }
    },

    /**
     * search_memory custom tool: LLM-accessible FTS5 search over project memory.
     * Triggered when the agent needs to recall durable knowledge from MEMORY.md.
     */
    tool: {
      search_memory: tool({
        description: "Search project memory (MEMORY.md) using FTS5 full-text search. Returns ranked results with snippets. Use when you need to recall rules, architecture decisions, or discovered knowledge from past sessions.",
        args: {
          query: tool.schema.string(),
          type: tool.schema.string().optional().describe("Filter by memory type: 'rules', 'architecture', 'discovered', 'context', or 'all' (default)"),
          limit: tool.schema.number().optional().describe("Max results (default 5)"),
        },
        async execute(args: SearchArgs, context: any) {
          try {
            const db = getDb(projectDir)
            const mDir = memoryDir(cfg, projectDir)
            const results = await searchMemory(db, mDir, {
              query: args.query,
              type: (args.type as any) ?? "all",
              limit: args.limit ?? 5,
            })
            return formatSearchResults(results, args.query)
          } catch (e) {
            log("error", "search_memory tool failed", { error: (e as Error).message })
            return `Search failed: ${(e as Error).message}`
          }
        },
      }),
    },
  }
}

export default MemoryPlugin
