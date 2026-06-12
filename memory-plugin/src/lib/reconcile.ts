import type { Database } from "bun:sqlite"
import { readFileSync, statSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { parsePath } from "./scope"

/**
 * Sync a single .md file into memory_fts.
 * Idempotent: if fingerprint unchanged, no-op.
 * Trigger memory_fts_ai / _au / _ad keeps the FTS5 index in sync.
 */
export function syncOneFile(db: Database, filePath: string, type: string): void {
  if (!existsSync(filePath)) return
  const stat = statSync(filePath)
  const fp = `${stat.size}-${stat.mtimeMs}`
  const indexed = db
    .query("SELECT fingerprint FROM memory_fts WHERE path = ?")
    .get(filePath) as { fingerprint: string } | null
  if (indexed?.fingerprint === fp) return

  const body = readFileSync(filePath, "utf-8")
  const locator = parsePath(filePath)
  const scope = locator?.scope ?? "projects"
  const scope_id = locator?.scope_id ?? ""

  db.query(
    `INSERT INTO memory_fts (path, scope, scope_id, type, body, fingerprint, last_indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       scope = excluded.scope,
       scope_id = excluded.scope_id,
       type = excluded.type,
       body = excluded.body,
       fingerprint = excluded.fingerprint,
       last_indexed_at = excluded.last_indexed_at`,
  ).run(filePath, scope, scope_id, type, body, fp, Date.now())
}

function walkMemoryDir(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const recurse = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) recurse(full)
      else if (entry.isFile() && full.endsWith(".md")) out.push(full)
    }
  }
  recurse(root)
  return out
}

export interface ReconcileResult {
  indexed: number
  pruned: number
}

/**
 * Walk memory dir, sync any new/changed files, prune rows for missing files.
 * Returns counts.
 */
export function reconcileMemory(db: Database, memoryDir: string): ReconcileResult {
  const diskFiles = new Set(walkMemoryDir(memoryDir))

  // Prune dead FTS rows
  const indexedPaths = (db.query("SELECT path FROM memory_fts").all() as { path: string }[]).map(
    (r) => r.path,
  )
  let pruned = 0
  for (const p of indexedPaths) {
    if (!diskFiles.has(p)) {
      db.query("DELETE FROM memory_fts WHERE path = ?").run(p)
      pruned++
    }
  }

  // Sync disk → DB
  let indexed = 0
  for (const f of diskFiles) {
    const before = db.query("SELECT fingerprint FROM memory_fts WHERE path = ?").get(f) as
      | { fingerprint: string }
      | null
    syncOneFile(db, f, "memory")
    const after = db.query("SELECT fingerprint FROM memory_fts WHERE path = ?").get(f) as
      | { fingerprint: string }
      | null
    if (before?.fingerprint !== after?.fingerprint) indexed++
  }

  return { indexed, pruned }
}
