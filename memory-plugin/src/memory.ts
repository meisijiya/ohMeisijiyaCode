import type { Database } from "bun:sqlite"
import { reconcileMemory } from "./lib/reconcile"
import { buildFtsQuery } from "./lib/fts-query"
import type { MemoryType } from "./lib/importance"

export interface SearchArgs {
  query: string
  type: MemoryType | "all"
  limit?: number
}

export interface SearchResult {
  path: string
  type: MemoryType
  snippet: string
  score: number
}

const SCORE_FLOOR = 0.15
const OVER_FETCH_MULTIPLIER = 3
const OVER_FETCH_CAP = 50

/**
 * Search MEMORY.md content using FTS5 BM25.
 * Performs lazy reconcile first to ensure index is fresh.
 * Updates hit_count and writes to memory_search_log.
 */
export async function searchMemory(
  db: Database,
  memoryDir: string,
  args: SearchArgs,
): Promise<SearchResult[]> {
  const limit = args.limit ?? 5
  if (!args.query.trim()) return []

  // 1. Lazy reconcile
  reconcileMemory(db, memoryDir)

  // 2. Build FTS5 query
  const ftsQuery = buildFtsQuery(args.query)
  if (!ftsQuery) return []

  // 3. Run BM25 search with over-fetch
  const fetchLimit = Math.min(limit * OVER_FETCH_MULTIPLIER, OVER_FETCH_CAP)
  const whereType = args.type !== "all" ? "AND memory_fts.type = ?" : ""
  const params: (string | number)[] = [ftsQuery]
  if (args.type !== "all") params.push(args.type)
  params.push(fetchLimit)

  const rows = db
    .query(
      `SELECT memory_fts.id, memory_fts.path, memory_fts.type,
              snippet(memory_fts_idx, 0, '<<', '>>', '...', 32) AS snippet,
              bm25(memory_fts_idx) AS score
       FROM memory_fts_idx
       JOIN memory_fts ON memory_fts.id = memory_fts_idx.rowid
       WHERE memory_fts_idx MATCH ?
         ${whereType}
       ORDER BY score
       LIMIT ?`,
    )
    .all(...params) as { id: number; path: string; type: MemoryType; snippet: string; score: number }[]

  if (rows.length === 0) return []

  // 4. Negate BM25 (lower=better in SQLite, higher=better for caller)
  const mapped = rows.map((r) => ({ ...r, score: -r.score }))

  // 5. Apply relative score floor
  const topScore = mapped[0].score
  const cutoff = topScore * SCORE_FLOOR
  const filtered = mapped.filter((r, i) => i === 0 || r.score >= cutoff).slice(0, limit)

  // 6. Update hit_count + write search log
  const now = Date.now()
  for (const r of filtered) {
    db.query("UPDATE memory_fts SET hit_count = hit_count + 1 WHERE id = ?").run(r.id)
    db.query("INSERT INTO memory_search_log (memory_id, query, time) VALUES (?, ?, ?)").run(
      r.id,
      args.query,
      now,
    )
  }

  return filtered.map(({ id, ...rest }) => rest)
}

/**
 * Format search results for agent output.
 * Mimic mimocode's memory tool output format.
 */
export function formatSearchResults(results: SearchResult[], query: string): string {
  if (results.length === 0) {
    return [
      `No matches for "${query}".`,
      ``,
      `0 results does NOT mean it was never recorded. Escalate before giving up:`,
      `1. Retry with FEWER / more distinctive terms — queries are OR-joined and`,
      `   ranked, so 1-2 rare words (an exact ID, function name, flag) beat a long`,
      `   descriptive phrase. Drop generic words ("config", "params", "database").`,
      `2. For a LITERAL string the tokenizer splits (URLs like postgres://…, ports`,
      `   like 5433, paths) — Grep the memory dir directly; FTS can't see it.`,
      `3. For VERBATIM recall of something a summary may have glossed over — use the history tool.`,
    ].join("\n")
  }

  const lines = [
    `Found ${results.length} match${results.length === 1 ? "" : "es"} (BM25-ranked, best first).`,
    `A hit here is authoritative — use it even if a parallel/sibling query returned nothing.`,
    ``,
  ]
  for (const r of results) {
    lines.push(`### ${r.path}`)
    lines.push(`Type: ${r.type}, Score: ${r.score.toFixed(3)}`)
    lines.push(r.snippet)
    lines.push("")
  }
  return lines.join("\n")
}
