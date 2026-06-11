/**
 * Memory Plugin for opencode 1.16.2
 *
 * 可选长期记忆功能：
 * - 启用：MEMORY.md 存在 或 .opencode/config.json 配置 memory.enabled
 * - 读取：每次用户消息按关键词判断是否需要注入
 * - 存储：experimental.text.complete 钩子捕获 LLM [SAVE_MEMORY] 标记
 * - 失效：标题行 [已过时] 标记 + 超期（默认 180 天）自动跳过
 *
 * 设计原则：
 * - 轻量：单文件实现，无外部依赖
 * - 可插拔：MEMORY.md 不存在时完全跳过
 * - 缓存友好：拼接到用户消息尾部（push），不修改系统提示
 * - 可观测：日志输出到 ~/.local/share/opencode/log/memory-plugin.log，
 *   格式与 opencode 主日志一致
 */

import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

const MEMORY_FILE = "MEMORY.md"
const DEFAULT_MAX_TOKENS = 3000
const DEFAULT_RETENTION_DAYS = 180
const SAVE_MEMORY_PATTERN = /\[SAVE_MEMORY\]([\s\S]*?)\[\/SAVE_MEMORY\]/

interface MemoryConfig {
  enabled: boolean
  retrieval: "keyword" | "agent" | "both"
  maxTokens: number
  retentionDays: number
}

// ============================================================================
// 日志（与 opencode 主日志同路径、同格式）
// 格式：<ISO timestamp> level=<LEVEL> source=memory-plugin message="<msg>" key=value
// ============================================================================

const LOG_DIR = process.env.XDG_DATA_HOME
  ? path.join(process.env.XDG_DATA_HOME, "opencode", "log")
  : path.join(os.homedir(), ".local", "share", "opencode", "log")
const LOG_FILE = path.join(LOG_DIR, "memory-plugin.log")

let logDirReady = false
async function ensureLogDir(): Promise<void> {
  if (logDirReady) return
  try {
    await fs.mkdir(LOG_DIR, { recursive: true })
    logDirReady = true
  } catch {
    // ignore
  }
}

function log(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  message: string,
  fields: Record<string, string | number> = {},
): void {
  const ts = new Date().toISOString()
  const kv = Object.entries(fields)
    .map(([k, v]) => {
      const s = String(v)
      return `${k}=${/\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s}`
    })
    .join(" ")
  const safeMsg = message.replace(/"/g, '\\"')
  const line = `${ts} level=${level} source=memory-plugin message="${safeMsg}" ${kv}\n`
  // Fire-and-forget：日志失败不影响主流程
  ensureLogDir()
    .then(() => fs.appendFile(LOG_FILE, line))
    .catch(() => {})
}

// ============================================================================
// 配置（每次调用都重读，支持热重载；MEMORY.md 运行期新建也能立即生效）
// ============================================================================

async function loadConfig(projectDir: string): Promise<MemoryConfig> {
  // 1. 优先读 .opencode/config.json 的 memory 字段
  const configPath = path.join(projectDir, ".opencode", "config.json")
  try {
    const raw = await Bun.file(configPath).text()
    const config = JSON.parse(raw)
    if (config?.memory && typeof config.memory === "object") {
      const m = config.memory
      return {
        enabled: m.enabled ?? true,
        retrieval: m.retrieval ?? "keyword",
        maxTokens: m.maxTokens ?? DEFAULT_MAX_TOKENS,
        retentionDays: m.retentionDays ?? DEFAULT_RETENTION_DAYS,
      }
    }
  } catch {
    // 文件不存在或 JSON 解析失败都忽略
  }

  // 2. 回退：MEMORY.md 文件存在
  const memoryPath = path.join(projectDir, MEMORY_FILE)
  try {
    await fs.access(memoryPath)
    return {
      enabled: true,
      retrieval: "keyword",
      maxTokens: DEFAULT_MAX_TOKENS,
      retentionDays: DEFAULT_RETENTION_DAYS,
    }
  } catch {
    // 也不存在
  }

  // 3. 默认不启用
  return {
    enabled: false,
    retrieval: "keyword",
    maxTokens: DEFAULT_MAX_TOKENS,
    retentionDays: DEFAULT_RETENTION_DAYS,
  }
}

// ============================================================================
// 检索判断：纯关键词匹配（agent 模式因 ctx.task 不存在也走关键词，标 WARN）
// ============================================================================

const KEYWORD_RE = /决策|原因|为什么|之前|上次|记得|教训|约束|选择|方案|架构|设计|限制|规范/i

function shouldRetrieveMemory(
  userMessage: string,
  config: MemoryConfig,
): { retrieve: boolean; reason: string } {
  // keyword / agent / both 都先做关键词匹配
  if (config.retrieval === "keyword" || config.retrieval === "agent" || config.retrieval === "both") {
    if (KEYWORD_RE.test(userMessage)) {
      // agent 模式本应调 sub-agent，但 opencode 1.16.2 插件 API 没有 ctx.task
      // 当前降级为关键词匹配；未来若用 ctx.client.session.chat 重写可去掉
      if (config.retrieval === "agent") {
        log("WARN", "agent mode using keyword fallback (no ctx.task in opencode 1.16.2 plugin API)")
      }
      return {
        retrieve: true,
        reason: config.retrieval === "agent" ? "keyword_fallback_for_agent" : "keyword_match",
      }
    }
  }
  return { retrieve: false, reason: "no_match" }
}

// ============================================================================
// 记忆读取：解析 + 过滤 + 段落边界截断
// ============================================================================

const ENTRY_HEADER_RE = /^(\d{4}-\d{2}-\d{2})(\s+\[已过时\])?/

interface MemoryEntry {
  raw: string // 原始段落文本（含 header + body）
  date: string | null
  isOutdated: boolean
}

function parseEntries(content: string): MemoryEntry[] {
  const sections = content.split(/^## /m)
  const entries: MemoryEntry[] = []
  for (const section of sections) {
    if (!section.trim()) continue
    const firstNewline = section.indexOf("\n")
    const headerLine =
      firstNewline === -1 ? section.trim() : section.substring(0, firstNewline).trim()
    const match = headerLine.match(ENTRY_HEADER_RE)
    if (match) {
      entries.push({
        raw: "## " + section, // 还原 ## 前缀
        date: match[1],
        isOutdated: !!match[2],
      })
    } else {
      // 非标准节（文件开头的注释/标题），原样保留
      entries.push({ raw: section, date: null, isOutdated: false })
    }
  }
  return entries
}

async function readMemory(projectDir: string, config: MemoryConfig): Promise<string> {
  const memoryPath = path.join(projectDir, MEMORY_FILE)
  let content: string
  try {
    content = await Bun.file(memoryPath).text()
  } catch {
    return ""
  }

  const entries = parseEntries(content)

  // 过滤：[已过时] 标题 + 超过 retentionDays 的条目
  const cutoffMs = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000
  let filtered = 0
  const valid = entries.filter((e) => {
    if (e.isOutdated) {
      filtered++
      return false
    }
    if (e.date) {
      const ms = Date.parse(e.date)
      if (!isNaN(ms) && ms < cutoffMs) {
        filtered++
        return false
      }
    }
    return true
  })
  if (filtered > 0) {
    log("INFO", "filtered entries", { filtered, kept: valid.length })
  }

  // 拼接所有有效条目
  let result = valid.map((e) => e.raw).join("")

  // 按 maxTokens 截断（在 ## 段落边界处切断）
  const maxChars = config.maxTokens * 4
  if (result.length > maxChars) {
    const head = result.substring(0, maxChars)
    const lastHeader = head.lastIndexOf("\n## ")
    if (lastHeader > 0) {
      result = head.substring(0, lastHeader)
      log("INFO", "memory truncated at section boundary", { chars: result.length, max: maxChars })
    } else {
      // 整个 head 里没有第二个段落边界（单个条目就超过 maxChars）
      result = head
      log("WARN", "memory truncated mid-entry (single entry exceeds limit)", {
        chars: result.length,
        max: maxChars,
      })
    }
  }
  return result
}

// ============================================================================
// 记忆存储：原子追加（O_APPEND，多并发安全）
// ============================================================================

async function appendToMemory(projectDir: string, content: string): Promise<void> {
  const memoryPath = path.join(projectDir, MEMORY_FILE)
  const timestamp = new Date().toISOString().split("T")[0]
  const entry = `\n\n## ${timestamp}\n${content.trim()}\n`
  // fs.appendFile 内部用 O_APPEND，多进程/多并发安全
  await fs.appendFile(memoryPath, entry)
  log("INFO", "memory saved", { chars: content.length, date: timestamp })
}

// ============================================================================
// Helpers
// ============================================================================

function extractUserText(parts: any[]): string {
  // 从用户 parts 提取纯文本（用于关键词匹配）
  // 用 \n 分隔多 part，避免误拼接（如 "git" + "commit" → "gitcommit" 假阳性）
  return parts
    .map((p) => {
      if (typeof p === "string") return p
      if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") {
        return p.text
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function removeSaveMemoryMarker(text: string): string {
  return text.replace(SAVE_MEMORY_PATTERN, "").trimEnd()
}

// ============================================================================
// Plugin
// ============================================================================

export const MemoryPlugin: Plugin = async (ctx) => {
  log("INFO", "plugin loaded", { directory: ctx.directory })

  return {
    /**
     * 用户消息钩子：判断是否需要注入记忆；如有则 push 上下文到 parts 末尾
     * 用 push（不是 unshift）保持和原 user parts 的自然顺序
     */
    "chat.message": async (input, output) => {
 const config = await loadConfig(ctx.directory)
 if (!config.enabled) return

 const userMessage = extractUserText(output.parts || [])
 if (!userMessage) return

 const decision = shouldRetrieveMemory(userMessage, config)
 if (!decision.retrieve) {
 log("DEBUG", "skip memory retrieval", { reason: decision.reason })
 return
 }

 const memory = await readMemory(ctx.directory, config)
 if (!memory) {
 log("INFO", "MEMORY.md empty or all entries filtered", { reason: decision.reason })
 return
 }

      output.parts = output.parts || []
      output.parts.push({
        //修复2: ID 品牌前缀 — opencode1.16.2 用 Zod isStartsWith 验证
        //   - PartID 必须 "prt" 开头
        //   - MessageID 必须 "msg" 开头
        //   - SessionID 必须 "ses" 开头
        //   - 验证失败会导致 part 被丢弃，UI 卡住、LLM 不启动
        id: `prt_${crypto.randomUUID()}`,
        sessionID: input.sessionID,
        messageID: output.message.id,
        type: "text",
        text: `[项目长期记忆]\n${memory}\n[end 项目长期记忆]`,
        synthetic: true,
      })
 log("INFO", "memory injected", { reason: decision.reason, chars: memory.length })
 },

    /**
     * LLM 文本完成钩子：捕获 [SAVE_MEMORY]...[/SAVE_MEMORY] 标记
     * 修复原版错把 SAVE_MEMORY 检测放在 chat.message（用户消息钩子）的 bug
     */
    "experimental.text.complete": async (_input, output) => {
      const config = await loadConfig(ctx.directory)
      if (!config.enabled) return

      const match = output.text.match(SAVE_MEMORY_PATTERN)
      if (!match) return

      const content = match[1].trim()
      if (!content) return

      try {
        await appendToMemory(ctx.directory, content)
        // 标记已捕获，从用户可见文本中移除
        output.text = removeSaveMemoryMarker(output.text)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        log("ERROR", "failed to save memory", { error: reason })
      }
    },
  }
}

export default MemoryPlugin
