import type { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

/**
 * Run all SQL files in memory-plugin/migration/ in lexicographic order.
 * Idempotent: tracks applied migrations in a `migrations` table; skips already-applied.
 *
 * Convention: migration filenames are dates like "2026-06-12-v2-001-name.sql".
 * The full filename is used as the migration identity.
 */
export function migrate(db: Database, migrationDir?: string): void {
  const dir = migrationDir ?? join(import.meta.dir, "..", "..", "migration")
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  // Ensure migrations table exists
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)

  for (const file of files) {
    const applied = db.query("SELECT 1 FROM migrations WHERE name = ?").get(file)
    if (applied) continue

    const sql = readFileSync(join(dir, file), "utf-8")
    // Split on --> statement-breakpoint (drizzle-kit convention)
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      db.exec(stmt)
    }
    db.query("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now())
  }
}
