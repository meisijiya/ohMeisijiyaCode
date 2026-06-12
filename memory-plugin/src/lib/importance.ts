export type MemoryType = "context" | "rules" | "architecture" | "discovered"

export interface Entry {
  id: number
  type: MemoryType
  body: string
  ageDays: number
  hitCount: number
}

const WEIGHTS: Record<MemoryType, number> = {
  rules: 10,
  architecture: 9,
  discovered: 7,
  context: 5,
}

/**
 * Piecewise age decay. Recent (0-6d) full weight; older progressively
 * downweighted. 180+ days plateau at 0.3 (still retrievable via search).
 */
export function ageDecay(days: number): number {
  if (days < 7) return 1.0
  if (days < 30) return 0.9
  if (days < 90) return 0.7
  if (days < 180) return 0.5
  return 0.3
}

/**
 * Importance score for a memory entry.
 * Formula: weight[type] × age_decay × (1 + log(1 + hit_count))
 * Hit count uses log scaling to prevent hot entries from dominating linearly.
 */
export function score(entry: Pick<Entry, "type" | "ageDays" | "hitCount">): number {
  return WEIGHTS[entry.type] * ageDecay(entry.ageDays) * (1 + Math.log(1 + entry.hitCount))
}

/**
 * Greedy top-N selection under a token budget.
 * Entries are sorted by score DESC; accumulated until budget is exhausted.
 * Returns full entries (with id and body) for the caller to render.
 */
export function selectTopN(entries: Entry[], budgetTokens: number): Entry[] {
  if (entries.length === 0 || budgetTokens <= 0) return []
  const sorted = [...entries].sort((a, b) => score(b) - score(a))
  const selected: Entry[] = []
  let tokens = 0
  for (const e of sorted) {
    const t = estimateTokens(e.body)
    if (tokens + t > budgetTokens) continue
    selected.push(e)
    tokens += t
  }
  return selected
}

/** Rough token estimate: 1 token ≈ 4 chars. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
