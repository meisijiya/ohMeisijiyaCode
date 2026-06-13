/**
 * v3.2 Long-term Memory Plugin for opencode 1.17.4
 *
 * v3.2 simplification: removed FTS5, search_memory tool, importance scoring,
 * reconcile.ts, and all SQLite. Counter is now a JSON file. Curator still
 * runs as a subagent but there's no delta vs full distinction — every dispatch
 * is "read queue.jsonl → write MEMORY.md → truncate queue.jsonl".
 *
 * Architecture:
 * - No I/O in plugin constructor
 * - Lazy file ops on first hook
 * - Uses data/memory/ (not data/memory-plugin.db)
 * - JSON file counter (project-scoped, shared across sessions)
 * - queue.jsonl is truncated after successful curator dispatch
 * - Disable per-project: {"memory": {"enabled": false}} in .opencode/opencode.json
 */
import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, readdirSync, unlinkSync, truncateSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { resolveProjectId } from "./lib/scope"

// ---- Config ----
interface MemoryConfig {
  enabled: boolean
  root: string
  /** User-turn threshold for forcing a curator dispatch. Default 15. */
  triggerThreshold: number
}

const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  root: "data/memory",
  triggerThreshold: 15,
}

// ---- Lazy state ----
let _client: any = null

function getConfig(project: any): MemoryConfig {
  if (project?.config?.memory === undefined) return DEFAULT_CONFIG
  return { ...DEFAULT_CONFIG, ...project.config.memory }
}

// ---- Structured logging ----
type LogLevel = "debug" | "info" | "warn" | "error"

function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const tagged = `[memory-plugin] ${message}`
  if (_client?.app?.log) {
    _client.app.log({ body: { service: "memory-plugin", level, message: tagged, ...(extra ? { extra } : {}) } }).catch(() => {})
  }
  if (level === "error") console.error(`[memory-plugin v3.2] ${message}`)
}

// ---- Data helpers ----

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

function truncateQueue(cfg: MemoryConfig, projectDir: string): void {
  try {
    const queuePath = join(projectDir, cfg.root, "queue.jsonl")
    if (existsSync(queuePath)) {
      truncateSync(queuePath, 0)
      log("info", "queue.jsonl truncated after curator dispatch")
    }
  } catch (e) {
    log("error", "truncateQueue failed", { error: (e as Error).message })
  }
}

/** Read MEMORY.md for direct LLM consumption. */
function readMemory(memoryDir: string): string {
  const mdPath = join(memoryDir, "MEMORY.md")
  if (!existsSync(mdPath)) return ""
  return readFileSync(mdPath, "utf-8")
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
    const prefix = ".hook-"
    const files = readdirSync(markerDir)
      .filter((f) => f.startsWith(prefix))
      .sort()
    while (files.length > 20) {
      const oldest = files.shift()!
      try { unlinkSync(join(markerDir, oldest)) } catch { /* best-effort */ }
    }
  } catch { /* best-effort diagnostics */ }
}

// ---- Project-scoped JSON counter ----
interface CounterEntry {
  turnCount: number
  lastFullAt: number | null
  lastDeltaAt: number | null
}

type CounterFile = Record<string, CounterEntry>

function counterPath(cfg: MemoryConfig, projectDir: string): string {
  return join(projectDir, cfg.root, "counter.json")
}

function readCounter(cfg: MemoryConfig, projectDir: string): CounterFile {
  const p = counterPath(cfg, projectDir)
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, "utf-8"))
  } catch {
    log("warn", "counter.json corrupted, resetting")
    return {}
  }
}

function writeCounter(cfg: MemoryConfig, projectDir: string, counter: CounterFile): void {
  const p = counterPath(cfg, projectDir)
  const dir = dirname(p)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(p, JSON.stringify(counter, null, 2) + "\n")
}

/** Atomically increment turn counter for project. Returns new count. */
function incrementTurnCount(cfg: MemoryConfig, projectDir: string, projectHash: string): number {
  const counter = readCounter(cfg, projectDir)
  const entry = counter[projectHash] ?? { turnCount: 0, lastFullAt: null, lastDeltaAt: null }
  entry.turnCount += 1
  entry.lastDeltaAt = Date.now()
  counter[projectHash] = entry
  writeCounter(cfg, projectDir, counter)
  return entry.turnCount
}

/** Reset turn counter to 0 (called after curator dispatch). */
function resetTurnCount(cfg: MemoryConfig, projectDir: string, projectHash: string): void {
  const counter = readCounter(cfg, projectDir)
  const entry = counter[projectHash] ?? { turnCount: 0, lastFullAt: null, lastDeltaAt: null }
  entry.turnCount = 0
  entry.lastFullAt = Date.now()
  counter[projectHash] = entry
  writeCounter(cfg, projectDir, counter)
}

/** Read current turn count for a project (0 if never seen). */
function getTurnCount(cfg: MemoryConfig, projectDir: string, projectHash: string): number {
  const counter = readCounter(cfg, projectDir)
  return counter[projectHash]?.turnCount ?? 0
}

// ---- Curator dispatch ----

/**
 * Spawn memory-curator subagent in background via SubtaskPartInput.
 *
 * v3.1 fix: client.tool.invoke("task-dispatch", ...) was the v2 dispatch path
 * but `tool` in opencode SDK only has list()/ids() — no invoke(). This silently
 * failed for every session.idle / /dream, leaving queue.jsonl to accumulate.
 *
 * v3.2: After successful dispatch, queue.jsonl is truncated. There's no
 * delta vs full distinction — every dispatch reads all of queue.jsonl,
 * writes MEMORY.md, and truncates. Counter is reset on dispatch.
 */
async function dispatchCurator(ctx: any, projectDir: string, cfg: MemoryConfig): Promise<void> {
  const client = ctx.client
  if (!client?.session?.prompt) {
    log("warn", "dispatchCurator: client.session.prompt unavailable")
    return
  }
  const queuePath = join(projectDir, cfg.root, "queue.jsonl")
  const queueSize = existsSync(queuePath) ? readFileSync(queuePath, "utf-8").length : 0
  const prompt = [
    `Memory reconcile trigger.`,
    `Project directory: ${projectDir}`,
    `Read data/memory/queue.jsonl for all accumulated messages (current size: ${queueSize} chars).`,
    `Read data/memory/projects/*/MEMORY.md for current state.`,
    `Apply LLM judgment to extract durable knowledge (Rules / Architecture decisions / Discovered / Context).`,
    `Edit MEMORY.md to merge similar entries, append new ones, drop superseded ones.`,
    `Hard limit: 250 lines. No KB limit. Preserve exact-form literals verbatim.`,
    `Follow the workflow defined in memory-plugin/agents/memory-curator.md.`,
    `Plugin will truncate queue.jsonl after you return — your job is to write MEMORY.md.`,
  ].join("\n")
  try {
    const sessionID = ctx.sessionID ?? (await client.session.create({ agent: "memory-curator" }).then(
      (r: any) => r?.data?.id,
      () => undefined,
    ))
    if (!sessionID) {
      log("warn", "dispatchCurator: no sessionID available")
      return
    }
    await client.session.prompt({
      sessionID,
      parts: [
        {
          type: "subtask",
          agent: "memory-curator",
          prompt,
          description: "memory curator reconcile",
        },
      ],
    } as any)
    log("info", "curator dispatched", { sessionID, queueSize })
    // v3.2: truncate queue.jsonl after dispatch — curator has it in context,
    // and any future re-dispatch should not re-process the same messages.
    truncateQueue(cfg, projectDir)
  } catch (e) {
    log("error", "dispatchCurator failed", { error: (e as Error).message })
  }
}

// ---- Plugin ----
export const MemoryPlugin: Plugin = async (ctx) => {
  // CONSTRUCTOR: ZERO I/O
  const projectDir: string = (ctx as any).directory ?? (ctx as any).worktree ?? process.cwd()
  const cfg = getConfig((ctx as any).project)
  _client = (ctx as any).client

  if (!cfg.enabled) {
    return {}
  }

  const mDir = memoryDir(cfg, projectDir)
  const projectHash = resolveProjectId(projectDir)

  log("info", "plugin loaded", { projectDir, projectHash, triggerThreshold: cfg.triggerThreshold })

  return {
    /**
     * /dream command: force curator dispatch + reset counter.
     */
    "tui.command.execute": async (input: any) => {
      try {
        if (input?.command !== "/dream") return
        ensureMemoryMd(mDir)
        writeMarker(projectDir, "dream", { triggeredBy: input?.sessionID ?? "?" })
        resetTurnCount(cfg, projectDir, projectHash)
        log("info", "/dream triggered (counter reset)")
        dispatchCurator(ctx, projectDir, cfg)

        return { output: "✓ /dream: curator dispatched (background). queue.jsonl will be truncated after reconcile." }
      } catch (e) {
        log("error", "/dream hook failed", { error: (e as Error).message })
        return { output: `✗ /dream failed: ${(e as Error).message}` }
      }
    },

    /**
     * Generic event handler: session lifecycle + message streams.
     */
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      try {
        if (event.type === "session.created") {
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
          // Project-scoped turn counter: shared across all sessions of this project.
          // When turn_count reaches triggerThreshold, dispatch curator + reset.
          try {
            const newCount = incrementTurnCount(cfg, projectDir, projectHash)
            writeMarker(projectDir, "session.idle.counted", { count: newCount, threshold: cfg.triggerThreshold })
            if (newCount >= cfg.triggerThreshold) {
              log("info", "trigger threshold reached — dispatching curator", {
                threshold: cfg.triggerThreshold,
                count: newCount,
              })
              resetTurnCount(cfg, projectDir, projectHash)
              dispatchCurator(ctx, projectDir, cfg)
            }
          } catch (e) {
            log("error", "session.idle counter logic failed", { error: (e as Error).message })
          }
        }

        if (event.type === "session.compacted") {
          writeMarker(projectDir, "session.compacted", {})
        }
      } catch (e) {
        log("error", "event handler failed", { eventType: event.type, error: (e as Error).message })
      }
    },
  }
}

export default MemoryPlugin
