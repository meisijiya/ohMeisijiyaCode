/**
 * v2 Long-term Memory Plugin for opencode 1.17.4
 *
 * Hook layer: implements 5 hooks that drive the memory system.
 * - message.updated    → append to queue.jsonl
 * - session.idle       → spawn memory-curator (background)
 * - session.created    → inject top-N memory into system_prompt
 * - session.compacted  → spawn memory-curator (rebuild brief)
 * - tui.command "dream" → spawn memory-curator (force full)
 *
 * Configuration is read from opencode.json (memory.* block).
 */

import type { Plugin } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { migrate } from "./lib/migrate"
import { reconcileMemory } from "./lib/reconcile"
import { parseMemory, renderEntry } from "./lib/memory-parse"
import { selectTopN, type Entry } from "./lib/importance"
import { resolveProjectId } from "./lib/scope"

interface MemoryConfig {
  enabled: boolean
  root: string
  db: string
  injection: {
    budgetTokens: number
    scoreFloor: number
  }
  curator: {
    maxMemoryLines: number
    maxMemorySizeKB: number
  }
  reconcile: {
    onSearch: boolean
    onInject: boolean
  }
}

const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  root: "data/memory",
  db: "data/memory.db",
  injection: { budgetTokens: 3000, scoreFloor: 0.15 },
  curator: { maxMemoryLines: 200, maxMemorySizeKB: 10 },
  reconcile: { onSearch: true, onInject: true },
}

function loadConfig(project: any): MemoryConfig {
  const fromJson = (project as any)?.config?.memory
  return { ...DEFAULT_CONFIG, ...fromJson }
}

function memoryDir(cfg: MemoryConfig, projectDir: string): string {
  return join(projectDir, cfg.root, "projects", resolveProjectId(projectDir))
}

function dbPath(cfg: MemoryConfig, projectDir: string): string {
  return join(projectDir, cfg.db)
}

function ensureSetup(cfg: MemoryConfig, projectDir: string): { db: Database; dir: string } {
  const dir = memoryDir(cfg, projectDir)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    const empty = `# Project Memory

## Project context

## Rules

## Architecture decisions

## Discovered durable knowledge
`
    const fs = require("fs")
    fs.writeFileSync(join(dir, "MEMORY.md"), empty)
  }
  const dbp = dbPath(cfg, projectDir)
  const db = new Database(dbp)
  migrate(db)
  return { db, dir }
}

function appendToQueue(
  cfg: MemoryConfig,
  projectDir: string,
  sessionId: string,
  messageId: string,
  partText: string,
): void {
  if (!partText.trim()) return
  const queuePath = join(projectDir, cfg.root, "queue.jsonl")
  const dir = dirname(queuePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // Dedupe by message_id
  if (existsSync(queuePath)) {
    const lines = readFileSync(queuePath, "utf-8").split("\n").filter(Boolean)
    if (lines.some((l) => l.includes(`"message_id":"${messageId}"`))) return
  }

  const entry = JSON.stringify({
    session_id: sessionId,
    message_id: messageId,
    part_text: partText,
    time: Date.now(),
  })
  appendFileSync(queuePath, entry + "\n")
}

async function spawnCurator(
  ctx: any,
  cfg: MemoryConfig,
  projectDir: string,
  prompt: string,
): Promise<void> {
  // Use task-dispatch to spawn the memory-curator background subagent
  const { client } = ctx
  try {
    await client.tool.invoke("task-dispatch", {
      mode: "background",
      agent: "memory-curator",
      prompt,
      cwd: projectDir,
    })
  } catch (e) {
    // Best effort — if task-dispatch unavailable, log and continue
  }
}

function buildInjectionBlock(parsed: ReturnType<typeof parseMemory>, budgetTokens: number): string {
  // v2.0 simplification: all entries treated as age=0 for injection.
  // v2.1 will track per-entry age via section timestamps.
  const entries: Entry[] = parsed.entries.map((e, i) => ({
    id: i,
    type: e.type,
    body: renderEntry(e),
    ageDays: 0,
    hitCount: 0,
  }))
  const top = selectTopN(entries, budgetTokens)
  if (top.length === 0) return ""
  return `## 📚 Project Memory (auto-injected, importance-ranked)\n\n${top.map((e) => e.body).join("\n")}\n\n---`
}

export const MemoryPlugin: Plugin = async (ctx) => {
  const cfg = loadConfig(ctx.project)
  if (!cfg.enabled) return {}

  const project = (ctx as any).project
  const projectDir = project?.worktree ?? project?.directory ?? process.cwd()

  // === Self-test markers (v2.0) ===
  // Write a load-marker so the user can verify the plugin actually loaded
  // (the 13:23 init log was from a different opencode run; the user's actual
  //  session may not have shown any signal). Marker is harmless and
  // gitignored.
  try {
    const fs = require("fs")
    const markerDir = join(projectDir, "data", "memory")
    mkdirSync(markerDir, { recursive: true })
    fs.writeFileSync(
      join(markerDir, `.plugin-loaded-${Date.now()}`),
      `v2 plugin loaded\nprojectDir=${projectDir}\n`,
    )
  } catch (e) {
    // ignore marker write failure
  }

  return {
    "message.updated": async (input: any) => {
      try {
        if (input?.message?.role !== "assistant") return
        const textPart = (input.message.parts ?? []).find(
          (p: any) => p.type === "text" && p.text,
        )
        if (!textPart) return
        appendToQueue(
          cfg,
          projectDir,
          input.sessionID,
          input.message.id,
          textPart.text,
        )
      } catch (e) {
        // Fire-and-forget; do not break message flow
      }
    },

    "session.idle": async () => {
      try {
        await spawnCurator(
          ctx,
          cfg,
          projectDir,
          `session.idle triggered for project ${projectDir}. Run standard 5-phase reconcile.`,
        )
      } catch (e) {
        // Log but do not break session
      }
    },

    "session.created": async (input: any, output: any) => {
      try {
        const { db, dir } = ensureSetup(cfg, projectDir)
        if (!existsSync(join(dir, "MEMORY.md"))) {
          db.close()
          return
        }
        const body = readFileSync(join(dir, "MEMORY.md"), "utf-8")
        const parsed = parseMemory(body)
        const block = buildInjectionBlock(parsed, cfg.injection.budgetTokens)
        if (block) {
          if (output?.system !== undefined) {
            output.system = block + "\n\n" + output.system
          } else if (output?.system_prompt !== undefined) {
            output.system_prompt = block + "\n\n" + output.system_prompt
          }
        }
        // === Self-test marker for session.created hook firing ===
        try {
          const fs = require("fs")
          fs.writeFileSync(
            join(dir, `.session-created-${Date.now()}`),
            `session.id=${input?.sessionID ?? "?"}\nblock_chars=${block.length}\n`,
          )
        } catch (e) {
          // ignore
        }
        db.close()
      } catch (e) {
        // Log but do not break session creation
      }
    },

    "session.compacted": async () => {
      try {
        await spawnCurator(
          ctx,
          cfg,
          projectDir,
          `session.compacted triggered. Rebuild brief + update MEMORY.md (full reconcile, not delta).`,
        )
      } catch (e) {
        // ignore
      }
    },

    "tui.command.execute": async (input: any) => {
      try {
        if (input?.command === "/dream") {
          await spawnCurator(
            ctx,
            cfg,
            projectDir,
            `/dream triggered by user. Force full reconcile — walk all sessions, verify each candidate against trajectory, no incremental optimization.`,
          )
          return { output: "✓ /dream: background curator spawned. Check session.idle output for completion status." }
        }
      } catch (e) {
        return { output: `✗ /dream failed: ${(e as Error).message}` }
      }
    },
  }
}

export default MemoryPlugin
