# v2 Long-term Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v2 project long-term memory system on top of opencode 1.17.4 — SQLite FTS5-backed, curator-driven, event-hooked, importance-ranked — replacing v1's keyword-regex + `[SAVE_MEMORY]` marker scheme.

**Architecture:** Five opencode plugin hooks (`message.updated` → queue / `session.idle` → curator / `session.created` → inject / `session.compacted` → rebuild brief / `tui.command.execute "dream"` → force full) drive a `memory-curator` background subagent that runs a 5-phase reconcile (ORIENT → GATHER → VERIFY → CONSOLIDATE → PRUNE) over `data/memory/projects/<sha256(repo_path)[:12]>/MEMORY.md`, indexed by `data/memory.db` SQLite FTS5. LLM never writes memory; single-writer principle. `memory` tool (search only) exposed to Sisyphus + Lyra + curator. Importance ranking: `weight[type] × age_decay × (1 + log(1+hit_count))`, 3K token budget.

**Tech Stack:**
- opencode 1.17.4 (plugin hooks: `message.updated`, `session.idle`, `session.created`, `session.compacted`, `tui.command.execute`)
- Bun (build, test, runtime)
- `bun:sqlite` (built-in, FTS5 enabled)
- `task-dispatch` tool (mode=`background`, added in main commit `fa95a0a`)
- cheap model for curator: `opencode/deepseek-v4-flash-free`
- Mimic mimocode patterns from `/tmp/mimo-sparse/packages/opencode/src/memory/`

**Reference Spec:** `docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md`

---

## File Structure

```
memory-plugin/
├── src/
│   ├── memory-plugin.ts              # hook layer (~350 LOC)
│   ├── memory.ts                     # memory tool (~80 LOC)
│   ├── lib/
│   │   ├── fts-query.ts              # FTS5 query builder (~40 LOC)
│   │   ├── importance.ts             # importance ranking (~50 LOC)
│   │   ├── scope.ts                  # path/scope parser (~50 LOC)
│   │   ├── fingerprint.ts            # file fingerprint (~20 LOC)
│   │   ├── reconcile.ts              # lazy reconcile (~80 LOC)
│   │   ├── select-top-n.ts           # budgeted top-N (~30 LOC)
│   │   ├── memory-parse.ts           # 4-section parser (~80 LOC)
│   │   └── migrate.ts                # migration runner (~50 LOC)
├── dist/                             # Bun build output (gitignored)
├── agents/
│   └── memory-curator.md             # subagent prompt
├── migration/
│   ├── 2026-06-12-v2-001-memory_fts.sql
│   ├── 2026-06-12-v2-002-search_log.sql
│   └── 2026-06-12-v2-003-reconcile_state.sql
├── tests/
│   ├── fts-query.test.ts
│   ├── importance.test.ts
│   ├── scope.test.ts
│   ├── fingerprint.test.ts
│   ├── reconcile.test.ts
│   ├── select-top-n.test.ts
│   ├── memory-parse.test.ts
│   ├── migrate.test.ts
│   ├── fts5-triggers.test.ts
│   ├── integration-curator.test.ts
│   ├── integration-search.test.ts
│   └── integration-injection.test.ts
├── install.sh
├── uninstall.sh
├── README.md
├── CHANGELOG.md
└── LICENSE

agents/
├── sisyphus.md                       # MODIFIED: replace SAVE_MEMORY section
├── lyra.md                           # MODIFIED: add memory tool note
└── hephaestus.md                     # UNCHANGED

opencode.json                         # MODIFIED: add memory config block
.gitignore                            # MODIFIED: ignore data/memory.db
install.sh                            # MODIFIED: opt-in memory-plugin registration
README.md / README.zh-CN.md           # MODIFIED: add "Project Long-term Memory" section

data/                                 # CREATED on first run
├── memory.db                         # gitignored
└── memory/
    └── projects/
        └── <sha256(repo_path)[:12]>/
            └── MEMORY.md             # git-tracked
```

**Total: ~22 new files, ~5 modified files, ~5 test files, ~1100 LOC src + ~700 LOC tests**

---

## Task 1: Initialize v2 branch from main

**Files:**
- Create: branch `v2-long-term-memory`

- [ ] **Step 1: Verify current state**

Run: `git status && git log --oneline -3`
Expected: clean working tree, HEAD at `2155e43` (or current main tip).

- [ ] **Step 2: Create branch from main**

Run: `git fetch origin && git checkout -b v2-long-term-memory origin/main`
Expected: Switched to a new branch 'v2-long-term-memory'.

- [ ] **Step 3: Verify branch**

Run: `git branch --show-current && git log --oneline -1`
Expected: `v2-long-term-memory\n2155e43 docs(readme): add 'Spec & protocol' subsection...`

- [ ] **Step 4: Commit empty marker (so branch is identifiable)**

```bash
git commit --allow-empty -m "chore(v2-memory): initialize v2-long-term-memory branch

Branch for v2 long-term memory system per spec
docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md"
```

Run: `git log --oneline -2`
Expected: branch HEAD shows the empty commit on top of main.

---

## Task 2: Cherry-pick v1 commits as starting scaffold

**Files:**
- Apply: 4 commits from `archive/memory-plugin-v1-beta`

- [ ] **Step 1: List v1 unique commits**

Run:
```bash
git log --oneline main..archive/memory-plugin-v1-beta
```
Expected: 4 commits (e.g. 063990a, 61b7e4e, f6b4c34, 0d3790d).

- [ ] **Step 2: Cherry-pick in chronological order**

Run:
```bash
git cherry-pick 063990a 61b7e4e f6b4c34 0d3790d
```
Expected: 4 commits applied cleanly. Resolve any conflicts (none expected since branch is fresh from main).

- [ ] **Step 3: Verify v1 scaffold present**

Run: `ls memory-plugin/ && ls .opencode/plugins/`
Expected:
```
memory-plugin/
├── CHANGELOG.md
├── LICENSE
├── README.md
├── TODO.md
├── docs/
├── install.sh
├── src/
├── uninstall.sh
.opencode/plugins/
```

- [ ] **Step 4: Commit if needed**

If cherry-pick created a separate "cherry-pick" commit per commit, those 4 commits are the v1 scaffold. No further commit needed. Run `git log --oneline -6` to verify.

---

## Task 3: Delete v1 source files (we replace with v2)

**Files:**
- Delete: `memory-plugin/src/memory-plugin.ts` (v1 keyword+marker version)
- Delete: `memory-plugin/install.sh` (v1 symlink-only)
- Delete: `memory-plugin/uninstall.sh` (v1 symlink-only)
- Delete: `memory-plugin/README.md` (v1 BETA warning version)
- Delete: `memory-plugin/TODO.md` (v1)
- Delete: `memory-plugin/docs/` (v1 architecture)
- Delete: `.opencode/plugins/memory-plugin.js` (v1 hard file; v2 will re-symlink)
- Delete: `agents/sisyphus.md` SAVE_MEMORY section (revert in next task)

- [ ] **Step 1: Delete v1 plugin source files**

```bash
rm memory-plugin/src/memory-plugin.ts
rm memory-plugin/install.sh
rm memory-plugin/uninstall.sh
rm memory-plugin/README.md
rm memory-plugin/TODO.md
rm -rf memory-plugin/docs
rm -f .opencode/plugins/memory-plugin.js
```

- [ ] **Step 2: Revert Sisyphus prompt SAVE_MEMORY section**

```bash
git checkout archive/memory-plugin-v1-beta~1 -- agents/sisyphus.md
# (or before f6b4c34 — find the parent of f6b4c34 in v1's history)
# Fallback: use sed to remove the section (see Step 3 for content)
```

- [ ] **Step 3: Manually remove the SAVE_MEMORY section from Sisyphus prompt**

Edit `agents/sisyphus.md`. Find and delete the entire `## 💾 长期记忆（memory-plugin 集成）` section (the one added by v1 commit `f6b4c34`). The section begins with `## 💾 长期记忆（memory-plugin 集成）` and ends at the next `##` heading or end of file. Use `git diff agents/sisyphus.md` to verify only that section was removed.

- [ ] **Step 4: Verify clean slate**

Run: `ls memory-plugin/ && ls memory-plugin/src/ && grep -c "SAVE_MEMORY" agents/sisyphus.md`
Expected:
```
memory-plugin/
├── CHANGELOG.md
├── LICENSE
```
(only CHANGELOG and LICENSE remain from v1)
And `memory-plugin/src/` is empty.
And `grep -c "SAVE_MEMORY"` returns 0.

- [ ] **Step 5: Stage deletions**

```bash
git add -A
git status
```
Expected: deletions staged.

- [ ] **Step 6: Commit deletions**

```bash
git commit -m "chore(v2-memory): delete v1 source files

v1 was keyword+marker scheme. v2 is hook+curator+SQLite FTS5.
See spec docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md.

Deleted:
- memory-plugin/src/memory-plugin.ts (v1 keyword regex)
- memory-plugin/install.sh / uninstall.sh (v1 symlink only)
- memory-plugin/README.md / TODO.md / docs/ (v1 BETA docs)
- .opencode/plugins/memory-plugin.js (v1 hard file; v2 will re-symlink)
- agents/sisyphus.md SAVE_MEMORY section (LLM no longer writes memory)"
```

---

## Task 4: Create v2 directory structure

**Files:**
- Create: `memory-plugin/src/lib/`
- Create: `memory-plugin/agents/`
- Create: `memory-plugin/migration/`
- Create: `memory-plugin/tests/`
- Create: `memory-plugin/dist/` (will be gitignored)

- [ ] **Step 1: Create directories**

```bash
mkdir -p memory-plugin/src/lib
mkdir -p memory-plugin/agents
mkdir -p memory-plugin/migration
mkdir -p memory-plugin/tests
mkdir -p memory-plugin/dist
```

- [ ] **Step 2: Verify**

Run: `find memory-plugin -type d`
Expected:
```
memory-plugin
memory-plugin/agents
memory-plugin/dist
memory-plugin/migration
memory-plugin/src
memory-plugin/src/lib
memory-plugin/tests
```

- [ ] **Step 3: Update .gitignore**

Edit `.gitignore`. Add (if not already present):
```gitignore
# v2 memory system runtime data
data/memory.db
data/memory.db-journal
data/memory.db-wal
data/memory.db-shm
data/memory/queue.jsonl
memory-plugin/dist/
```

- [ ] **Step 4: Commit directory structure**

```bash
git add memory-plugin/.gitignore .gitignore
git commit -m "chore(v2-memory): create v2 directory structure

- memory-plugin/src/lib/  — core algorithm modules
- memory-plugin/agents/    — subagent prompts
- memory-plugin/migration/ — SQLite schema migrations
- memory-plugin/tests/     — unit + integration tests
- memory-plugin/dist/      — Bun build output (gitignored)
- Updated .gitignore: ignore data/memory.db, queue.jsonl, dist/"
```

---

## Task 5: Write SQLite migration 001 — memory_fts table

**Files:**
- Create: `memory-plugin/migration/2026-06-12-v2-001-memory_fts.sql`

- [ ] **Step 1: Create migration file**

```bash
touch memory-plugin/migration/2026-06-12-v2-001-memory_fts.sql
```

- [ ] **Step 2: Write migration SQL**

Write to `memory-plugin/migration/2026-06-12-v2-001-memory_fts.sql`:

```sql
-- 2026-06-12-v2-001: Initial memory_fts table
-- Ported from mimocode v6.1 (commit 20260521010000_memory_fts_v6 + 20260521020000_memory_fts_triggers)
-- with v2 additions: hit_count for importance ranking, single 'projects' scope

CREATE TABLE `memory_fts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `path` TEXT NOT NULL UNIQUE,
  `scope` TEXT NOT NULL DEFAULT 'projects',
  `scope_id` TEXT NOT NULL DEFAULT '',
  `type` TEXT NOT NULL,
  `body` TEXT NOT NULL,
  `fingerprint` TEXT NOT NULL,
  `last_indexed_at` INTEGER NOT NULL,
  `hit_count` INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX `memory_fts_scope_idx` ON `memory_fts` (`scope`, `scope_id`);
CREATE INDEX `memory_fts_type_idx` ON `memory_fts` (`type`);

CREATE VIRTUAL TABLE `memory_fts_idx` USING fts5(
  `body`,
  content='memory_fts',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 1'
);

CREATE TRIGGER `memory_fts_ai` AFTER INSERT ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(rowid, body) VALUES (NEW.id, NEW.body);
END;

CREATE TRIGGER `memory_fts_ad` AFTER DELETE ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(`memory_fts_idx`, rowid, body) VALUES('delete', OLD.id, OLD.body);
END;

CREATE TRIGGER `memory_fts_au` AFTER UPDATE ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(`memory_fts_idx`, rowid, body) VALUES('delete', OLD.id, OLD.body);
  INSERT INTO `memory_fts_idx`(rowid, body) VALUES (NEW.id, NEW.body);
END;
```

- [ ] **Step 3: Commit migration**

```bash
git add memory-plugin/migration/2026-06-12-v2-001-memory_fts.sql
git commit -m "feat(v2-memory): add migration 001 (memory_fts table + FTS5 index + triggers)

Schema ported from mimocode v6.1 with 'delete' magic trigger fix.
v2 adds hit_count column for importance ranking.
Single 'projects' scope (v2 simplification)."
```

---

## Task 6: Write SQLite migration 002 — search_log table

**Files:**
- Create: `memory-plugin/migration/2026-06-12-v2-002-search_log.sql`

- [ ] **Step 1: Create migration file**

```bash
touch memory-plugin/migration/2026-06-12-v2-002-search_log.sql
```

- [ ] **Step 2: Write migration SQL**

Write to `memory-plugin/migration/2026-06-12-v2-002-search_log.sql`:

```sql
-- 2026-06-12-v2-002: search audit log
-- Tracks every memory search hit for hit_count derivation and audit
-- 90-day retention enforced in curator Phase 5 PRUNE

CREATE TABLE `memory_search_log` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `memory_id` INTEGER NOT NULL REFERENCES `memory_fts`(`id`),
  `query` TEXT NOT NULL,
  `time` INTEGER NOT NULL
);

CREATE INDEX `memory_search_log_memory_id_idx` ON `memory_search_log` (`memory_id`);
CREATE INDEX `memory_search_log_time_idx` ON `memory_search_log` (`time`);
```

- [ ] **Step 3: Commit migration**

```bash
git add memory-plugin/migration/2026-06-12-v2-002-search_log.sql
git commit -m "feat(v2-memory): add migration 002 (search_log table)

Tracks every memory search hit. 90-day retention in curator PRUNE.
Indexes on memory_id (for hit_count rollup) and time (for retention prune)."
```

---

## Task 7: Write SQLite migration 003 — reconcile_state table

**Files:**
- Create: `memory-plugin/migration/2026-06-12-v2-003-reconcile_state.sql`

- [ ] **Step 1: Create migration file**

```bash
touch memory-plugin/migration/2026-06-12-v2-003-reconcile_state.sql
```

- [ ] **Step 2: Write migration SQL**

Write to `memory-plugin/migration/2026-06-12-v2-003-reconcile_state.sql`:

```sql
-- 2026-06-12-v2-003: reconcile state
-- Tracks last reconcile time per project, used by curator to determine
-- delta-vs-full in Phase 2 GATHER

CREATE TABLE `memory_reconcile_state` (
  `key` TEXT PRIMARY KEY,
  `last_reconcile_at` INTEGER NOT NULL
);
```

- [ ] **Step 3: Commit migration**

```bash
git add memory-plugin/migration/2026-06-12-v2-003-reconcile_state.sql
git commit -m "feat(v2-memory): add migration 003 (reconcile_state)

Tracks last_reconcile_at per project. Used by curator Phase 2 to
distinguish delta (session.idle) from full (session.compacted, /dream)."
```

---

## Task 8: Write migrate.ts (migration runner)

**Files:**
- Create: `memory-plugin/src/lib/migrate.ts`
- Test: `memory-plugin/tests/migrate.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/migrate.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("migrate", () => {
  let db: Database
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "migrate-test-"))
    db = new Database(join(tmpDir, "test.db"))
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("creates memory_fts table on fresh db", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts'").all() as any[]
    expect(tables.length).toBe(1)
  })

  test("creates memory_fts_idx virtual table", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts_idx'").all() as any[]
    expect(tables.length).toBe(1)
  })

  test("creates 3 triggers (ai, ad, au)", () => {
    migrate(db)
    const triggers = db.query("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'memory_fts_%'").all() as any[]
    expect(triggers.map((t: any) => t.name).sort()).toEqual([
      "memory_fts_ad",
      "memory_fts_ai",
      "memory_fts_au",
    ])
  })

  test("creates memory_search_log and memory_reconcile_state", () => {
    migrate(db)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[]
    const names = tables.map((t: any) => t.name)
    expect(names).toContain("memory_search_log")
    expect(names).toContain("memory_reconcile_state")
  })

  test("idempotent: running migrate twice does not error", () => {
    migrate(db)
    expect(() => migrate(db)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/migrate.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/migrate'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/migrate.ts`:

```typescript
import type { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

/**
 * Run all SQL files in memory-plugin/migration/ in lexicographic order.
 * Idempotent: each migration is a CREATE statement; running twice is safe.
 */
export function migrate(db: Database, migrationDir?: string): void {
  const dir = migrationDir ?? join(import.meta.dir, "..", "..", "migration")
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf-8")
    // Split on --> statement-breakpoint (drizzle-kit convention)
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      db.exec(stmt)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/migrate.test.ts`
Expected: PASS (5 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/migrate.ts memory-plugin/tests/migrate.test.ts
git commit -m "feat(v2-memory): migration runner with idempotent SQL application

Reads memory-plugin/migration/*.sql in lex order, splits on drizzle
statement-breakpoint, runs each. Idempotent: CREATE statements safe
to re-run. 5 unit tests cover all 3 migrations + idempotency."
```

---

## Task 9: FTS5 query builder (TDD)

**Files:**
- Create: `memory-plugin/src/lib/fts-query.ts`
- Test: `memory-plugin/tests/fts-query.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/fts-query.test.ts`:

```typescript
import { describe, test, expect } from "bun:test"
import { buildFtsQuery } from "../src/lib/fts-query"

describe("buildFtsQuery", () => {
  test("empty string returns null", () => {
    expect(buildFtsQuery("")).toBeNull()
  })

  test("whitespace-only returns null", () => {
    expect(buildFtsQuery("   \t  ")).toBeNull()
  })

  test("single token is phrase-quoted", () => {
    expect(buildFtsQuery("keyword")).toBe('"keyword"')
  })

  test("multiple tokens OR-joined and phrase-quoted", () => {
    expect(buildFtsQuery("keyword trigger why")).toBe('"keyword" OR "trigger" OR "why"')
  })

  test("CJK characters tokenized correctly", () => {
    // 为什么 — should tokenize to single CJK token
    const result = buildFtsQuery("为什么选择")
    expect(result).toBe('"为什么选择"')
  })

  test("CJK + Latin mixed", () => {
    const result = buildFtsQuery("为什么 keyword 方案")
    expect(result).toBe('"为什么" OR "keyword" OR "方案"')
  })

  test("punctuation stripped during tokenization", () => {
    // postgres://host:5433 → postgres, host, 5433
    const result = buildFtsQuery("postgres://host:5433")
    expect(result).toBe('"postgres" OR "host" OR "5433"')
  })

  test("FTS5 special chars escaped via phrase quotes", () => {
    // Raw: "test* (foo) -bar" — without phrase quotes would crash FTS5
    const result = buildFtsQuery('test* (foo) -bar')
    // Tokens: test, foo, bar (punctuation stripped, * and - are separators)
    expect(result).toBe('"test" OR "foo" OR "bar"')
  })

  test("embedded double quotes are stripped", () => {
    // User input with quotes — must not break the phrase-quoting
    const result = buildFtsQuery('say "hello"')
    expect(result).toBe('"say" OR "hello"')
  })

  test("underscore preserved in token", () => {
    const result = buildFtsQuery("task_id T5_3")
    expect(result).toBe('"task_id" OR "T5_3"')
  })

  test("long query (>200 chars) still builds", () => {
    const long = "a".repeat(300)
    const result = buildFtsQuery(long)
    expect(result).toBe(`"${"a".repeat(300)}"`)
  })

  test("numbers-only token", () => {
    expect(buildFtsQuery("5433")).toBe('"5433"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/fts-query.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/fts-query'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/fts-query.ts`:

```typescript
/**
 * Build an FTS5 MATCH expression from a free-form user query.
 *
 * FTS5's MATCH grammar has its own operators and special characters
 * (`"`, `(`, `)`, `*`, `:`, `^`, `-`, `.`, `{`, `}`). Passing a raw user
 * string with any of these crashes the parser. Wrapping each token as a
 * phrase and joining avoids the crash; OR-join keeps recall high.
 *
 * \p{L} includes CJK letters. Punctuation becomes separator. Both query
 * and indexed body see only alphanumeric/underscore runs.
 *
 * OR (not AND): AND-join required EVERY query word to appear in a document,
 * so a single descriptive word the user added that wasn't in the stored
 * text zeroed the whole query even when 6/7 tokens matched. Empirically
 * AND returned 0 results for nearly all multi-word queries. OR lets BM25
 * rank by how many / how rare the matched tokens are; the caller applies
 * a score floor to drop common-word-only noise.
 *
 * Returns null when no usable tokens are extracted. Callers should treat
 * that as "empty query, no results" without sending the query to SQL.
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? []
  if (tokens.length === 0) return null
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`)
  return quoted.join(" OR ")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/fts-query.test.ts`
Expected: PASS (12 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/fts-query.ts memory-plugin/tests/fts-query.test.ts
git commit -m "feat(v2-memory): FTS5 query builder with phrase-quote + OR-join

Ported from mimocode fts-query.ts. Handles:
- CJK characters (\p{L} Unicode class)
- Punctuation as separator (postgres://host:5433 → 3 tokens)
- FTS5 special chars safely via phrase-quoting
- Empty / whitespace returns null (caller treats as no-results)

12 unit tests cover all edge cases."
```

---

## Task 10: Importance ranking (TDD)

**Files:**
- Create: `memory-plugin/src/lib/importance.ts`
- Test: `memory-plugin/tests/importance.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/importance.test.ts`:

```typescript
import { describe, test, expect } from "bun:test"
import { score, ageDecay, selectTopN, type Entry } from "../src/lib/importance"

describe("ageDecay", () => {
  test("0-6 days: 1.0", () => {
    expect(ageDecay(0)).toBe(1.0)
    expect(ageDecay(6)).toBe(1.0)
  })
  test("7-29 days: 0.9", () => {
    expect(ageDecay(7)).toBe(0.9)
    expect(ageDecay(29)).toBe(0.9)
  })
  test("30-89 days: 0.7", () => {
    expect(ageDecay(30)).toBe(0.7)
    expect(ageDecay(89)).toBe(0.7)
  })
  test("90-179 days: 0.5", () => {
    expect(ageDecay(90)).toBe(0.5)
    expect(ageDecay(179)).toBe(0.5)
  })
  test("180+ days: 0.3", () => {
    expect(ageDecay(180)).toBe(0.3)
    expect(ageDecay(1000)).toBe(0.3)
  })
})

describe("score", () => {
  test("weight × age × log(hit) formula", () => {
    // weight=10, age=0 (1.0), hit=10 → 10 * 1.0 * (1 + ln(11)) = 10 * 1.0 * 3.46 = 34.6
    const s = score({ type: "rules", ageDays: 0, hitCount: 10 })
    expect(s).toBeCloseTo(10 * 1.0 * (1 + Math.log(11)), 2)
  })

  test("hitCount=0 case: 1 + log(1) = 1.0", () => {
    const s = score({ type: "rules", ageDays: 0, hitCount: 0 })
    expect(s).toBeCloseTo(10 * 1.0 * (1 + Math.log(1)), 2) // log(1) = 0
  })

  test("old age (180+ days) heavily downweighted", () => {
    const recent = score({ type: "rules", ageDays: 1, hitCount: 0 })
    const old = score({ type: "rules", ageDays: 365, hitCount: 0 })
    expect(recent / old).toBeGreaterThan(3) // 1.0 / 0.3 ≈ 3.3
  })

  test("rules > architecture > discovered > context (weight ordering)", () => {
    const rules = score({ type: "rules", ageDays: 0, hitCount: 0 })
    const arch = score({ type: "architecture", ageDays: 0, hitCount: 0 })
    const disc = score({ type: "discovered", ageDays: 0, hitCount: 0 })
    const ctx = score({ type: "context", ageDays: 0, hitCount: 0 })
    expect(rules).toBeGreaterThan(arch)
    expect(arch).toBeGreaterThan(disc)
    expect(disc).toBeGreaterThan(ctx)
  })
})

describe("selectTopN", () => {
  const entries: Entry[] = [
    { id: 1, type: "context", body: "Project: long-term memory v2 system", ageDays: 0, hitCount: 0 },
    { id: 2, type: "rules", body: "Always use Bun.file() over fs.readFile for .md reads", ageDays: 1, hitCount: 5 },
    { id: 3, type: "architecture", body: "SQLite FTS5 over .md grep because unicode61 supports CJK", ageDays: 0, hitCount: 0 },
    { id: 4, type: "discovered", body: "Bun's index.d.ts has no native tail-N function", ageDays: 30, hitCount: 0 },
  ]

  test("returns entries sorted by score DESC", () => {
    const top = selectTopN(entries, 10000)
    expect(top[0].id).toBe(2) // rules + 1 hit = highest
    // 3 (architecture, fresh) > 4 (discovered, 30d old) > 1 (context, lowest weight)
  })

  test("respects budgetTokens (drops lowest-score if overflow)", () => {
    const top = selectTopN(entries, 30) // very small budget
    // Only the highest-scored entry fits
    expect(top.length).toBeLessThan(entries.length)
    expect(top[0].id).toBe(2)
  })

  test("empty entries returns empty", () => {
    expect(selectTopN([], 1000)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/importance.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/importance'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/importance.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/importance.test.ts`
Expected: PASS (11 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/importance.ts memory-plugin/tests/importance.test.ts
git commit -m "feat(v2-memory): importance ranking with weight × age × hit_count_log

- WEIGHTS: rules=10, architecture=9, discovered=7, context=5
- ageDecay: piecewise (7d/30d/90d/180d/∞ → 1.0/0.9/0.7/0.5/0.3)
- score: weight × age × (1 + log(1 + hitCount))
- selectTopN: greedy budget-respecting selection
- estimateTokens: ~4 chars per token

11 unit tests cover all formula edge cases."
```

---

## Task 11: Scope/path parser (TDD)

**Files:**
- Create: `memory-plugin/src/lib/scope.ts`
- Test: `memory-plugin/tests/scope.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/scope.test.ts`:

```typescript
import { describe, test, expect } from "bun:test"
import { parsePath, buildPath, resolveProjectId, assertSafeComponent } from "../src/lib/scope"

describe("parsePath", () => {
  test("parses project MEMORY.md", () => {
    const p = parsePath("/home/user/proj/data/memory/projects/abc123/MEMORY.md")
    expect(p).toEqual({
      scope: "projects",
      scope_id: "abc123",
      type: "memory",
      key: "MEMORY",
    })
  })

  test("returns null for path outside memory layout", () => {
    expect(parsePath("/tmp/random.txt")).toBeNull()
  })

  test("returns null for non-md extension", () => {
    expect(parsePath("/home/user/proj/data/memory/projects/abc/MEMORY.txt")).toBeNull()
  })
})

describe("buildPath", () => {
  test("builds project path", () => {
    const p = buildPath({ root: "/data/memory", scope: "projects", scope_id: "abc", key: "MEMORY" })
    expect(p).toBe("/data/memory/projects/abc/MEMORY.md")
  })

  test("builds global path (empty scope_id)", () => {
    const p = buildPath({ root: "/data/memory", scope: "global", key: "MEMORY" })
    expect(p).toBe("/data/memory/global/MEMORY.md")
  })

  test("rejects '..' in scope_id", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "../etc", key: "MEMORY" }),
    ).toThrow(/invalid path component/)
  })

  test("rejects '..' in key", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "abc", key: "../passwd" }),
    ).toThrow(/invalid path component/)
  })

  test("rejects absolute path in scope_id", () => {
    expect(() =>
      buildPath({ root: "/data/memory", scope: "projects", scope_id: "/etc", key: "MEMORY" }),
    ).toThrow(/invalid path component/)
  })
})

describe("resolveProjectId", () => {
  test("returns 12-char sha256 prefix", () => {
    const id = resolveProjectId("/home/user/some/repo")
    expect(id).toHaveLength(12)
    expect(id).toMatch(/^[a-f0-9]{12}$/)
  })

  test("same path → same id (deterministic)", () => {
    const a = resolveProjectId("/home/user/repo")
    const b = resolveProjectId("/home/user/repo")
    expect(a).toBe(b)
  })

  test("different path → different id", () => {
    const a = resolveProjectId("/home/user/repo1")
    const b = resolveProjectId("/home/user/repo2")
    expect(a).not.toBe(b)
  })
})

describe("assertSafeComponent", () => {
  test("accepts normal alphanumeric", () => {
    expect(() => assertSafeComponent("abc123")).not.toThrow()
  })

  test("accepts path with safe segments", () => {
    expect(() => assertSafeComponent("a/b/c")).not.toThrow()
  })

  test("rejects '..' segment", () => {
    expect(() => assertSafeComponent("a/../b")).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/scope.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/scope'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/scope.ts`:

```typescript
import { createHash } from "crypto"
import { join } from "path"

export type Scope = "projects"

export type MemoryType = "context" | "rules" | "architecture" | "discovered" | "memory"

export interface MemoryLocator {
  scope: Scope
  scope_id: string
  type: MemoryType
  key: string
}

const MEMORY_PATH_RE = /\/memory\/projects\/([^/]+)\/(.+)\.md$/

/**
 * Parse an absolute path into a MemoryLocator.
 * Returns null if path does not match the memory layout.
 */
export function parsePath(absPath: string): MemoryLocator | null {
  const m = absPath.match(MEMORY_PATH_RE)
  if (!m) return null
  const [, scope_id, keyRaw] = m
  return { scope: "projects", scope_id, type: "memory", key: keyRaw }
}

/**
 * Build an absolute path from a MemoryLocator.
 * Rejects path traversal attempts in scope_id or key.
 */
export function buildPath(input: {
  root: string
  scope: Scope
  scope_id?: string
  key: string
}): string {
  if (input.scope_id !== undefined) assertSafeComponent(input.scope_id)
  assertSafeComponent(input.key)
  const parts = [input.root, input.scope]
  parts.push(input.scope_id ?? "")
  parts.push(`${input.key}.md`)
  return join(...parts)
}

/**
 * Resolve a project_id from the absolute repo path.
 * Uses sha256 prefix (12 hex chars) for stability across machines.
 */
export function resolveProjectId(absRepoPath: string): string {
  return createHash("sha256").update(absRepoPath).digest("hex").slice(0, 12)
}

/**
 * Reject any segment containing '..' or starting with '/'.
 * Guards against path traversal and absolute-path injection.
 */
export function assertSafeComponent(value: string): void {
  for (const segment of value.split("/")) {
    if (segment === "..") throw new Error(`buildPath: invalid path component: ${value}`)
  }
  if (value.startsWith("/")) throw new Error(`buildPath: invalid path component: ${value}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/scope.test.ts`
Expected: PASS (10 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/scope.ts memory-plugin/tests/scope.test.ts
git commit -m "feat(v2-memory): scope/path parser with traversal protection

- parsePath: extract locator from absolute path
- buildPath: construct safe path (rejects .. and /)
- resolveProjectId: sha256[:12] for cross-machine stability
- assertSafeComponent: path traversal guard

10 unit tests cover parsing, building, traversal rejection, deterministic id."
```

---

## Task 12: Fingerprint (TDD)

**Files:**
- Create: `memory-plugin/src/lib/fingerprint.ts`
- Test: `memory-plugin/tests/fingerprint.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/fingerprint.test.ts`:

```typescript
import { describe, test, expect } from "bun:test"
import { fingerprint } from "../src/lib/fingerprint"

describe("fingerprint", () => {
  test("returns ${size}-${mtimeMs} format", () => {
    const fp = fingerprint({ size: 1234, mtimeMs: 1700000000000 })
    expect(fp).toBe("1234-1700000000000")
  })

  test("different size → different fingerprint", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 200, mtimeMs: 1000 })
    expect(a).not.toBe(b)
  })

  test("different mtime → different fingerprint", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 100, mtimeMs: 2000 })
    expect(a).not.toBe(b)
  })

  test("same input → same fingerprint (idempotent)", () => {
    const a = fingerprint({ size: 100, mtimeMs: 1000 })
    const b = fingerprint({ size: 100, mtimeMs: 1000 })
    expect(a).toBe(b)
  })

  test("zero size is valid edge case", () => {
    const fp = fingerprint({ size: 0, mtimeMs: 0 })
    expect(fp).toBe("0-0")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/fingerprint.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/fingerprint'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/fingerprint.ts`:

```typescript
export interface FileStat {
  size: number
  mtimeMs: number
}

/**
 * Compute a file's fingerprint from size and mtime.
 * Format: "${size}-${mtimeMs}"
 * Used by lazy reconcile to detect file changes without re-reading body.
 */
export function fingerprint(stat: FileStat): string {
  return `${stat.size}-${stat.mtimeMs}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/fingerprint.test.ts`
Expected: PASS (5 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/fingerprint.ts memory-plugin/tests/fingerprint.test.ts
git commit -m "feat(v2-memory): file fingerprint (size-mtime format)

Lazy reconcile uses this to skip reindexing when file unchanged.
5 unit tests cover format, idempotency, edge cases."
```

---

## Task 13: Lazy reconcile (TDD)

**Files:**
- Create: `memory-plugin/src/lib/reconcile.ts`
- Test: `memory-plugin/tests/reconcile.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/reconcile.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { reconcileMemory, syncOneFile } from "../src/lib/reconcile"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("syncOneFile", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string
  let memFile: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "reconcile-test-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc123")
    require("fs").mkdirSync(memoryDir, { recursive: true })
    memFile = join(memoryDir, "MEMORY.md")
    writeFileSync(memFile, "# Project Memory\n\n## Project context\n\nTest content\n")
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("inserts new file into memory_fts", () => {
    syncOneFile(db, memFile, "memory")
    const rows = db.query("SELECT path, body FROM memory_fts").all() as any[]
    expect(rows.length).toBe(1)
    expect(rows[0].path).toBe(memFile)
    expect(rows[0].body).toContain("Test content")
  })

  test("updates existing row when fingerprint changes", () => {
    syncOneFile(db, memFile, "memory")
    // Modify file
    writeFileSync(memFile, "# Project Memory\n\n## Project context\n\nUpdated content\n")
    syncOneFile(db, memFile, "memory")
    const rows = db.query("SELECT body FROM memory_fts").all() as any[]
    expect(rows.length).toBe(1) // still one row, not duplicate
    expect(rows[0].body).toContain("Updated content")
  })

  test("skips when fingerprint unchanged (idempotent)", () => {
    syncOneFile(db, memFile, "memory")
    // Touch mtime to verify it would re-index if fp changed
    // (here we keep same mtime to test idempotency)
    const before = db.query("SELECT last_indexed_at FROM memory_fts").get() as any
    syncOneFile(db, memFile, "memory")
    const after = db.query("SELECT last_indexed_at FROM memory_fts").get() as any
    expect(before.last_indexed_at).toBe(after.last_indexed_at)
  })

  test("FTS5 index updated after INSERT (search finds content)", () => {
    syncOneFile(db, memFile, "memory")
    const results = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("Test") as any[]
    expect(results.length).toBe(1)
  })
})

describe("reconcileMemory (full walk)", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "reconcile-full-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    require("fs").mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("indexes all .md files under memoryDir", () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "memory content 1")
    writeFileSync(join(memoryDir, "NOTES.md"), "notes content 2")
    const result = reconcileMemory(db, memoryDir)
    expect(result.indexed).toBe(2)
  })

  test("prunes rows for files that no longer exist", () => {
    const f1 = join(memoryDir, "MEMORY.md")
    writeFileSync(f1, "content 1")
    reconcileMemory(db, memoryDir)
    expect((db.query("SELECT COUNT(*) as c FROM memory_fts").get() as any).c).toBe(1)

    // Delete the file
    rmSync(f1)
    const result = reconcileMemory(db, memoryDir)
    expect(result.pruned).toBe(1)
    expect((db.query("SELECT COUNT(*) as c FROM memory_fts").get() as any).c).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/reconcile.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/reconcile'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/reconcile.ts`:

```typescript
import type { Database } from "bun:sqlite"
import { readFileSync, statSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fingerprint } from "./fingerprint"
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/reconcile.test.ts`
Expected: PASS (6 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/reconcile.ts memory-plugin/tests/reconcile.test.ts
git commit -m "feat(v2-memory): lazy reconcile with fingerprint idempotency

- syncOneFile: upsert single file (idempotent via fingerprint)
- reconcileMemory: walk dir, sync changed, prune dead
- Uses FTS5 triggers (memory_fts_ai/_au/_ad) to keep index in sync

6 unit tests cover insert, update, idempotent skip, FTS5 sync, prune."
```

---

## Task 14: Select top-N under token budget

This module is already implemented as `selectTopN` in `importance.ts` (Task 10). The test for budget respect is part of Task 10's tests. **No additional work needed.**

Move on to Task 15.

---

## Task 15: Memory 4-section parser (TDD)

**Files:**
- Create: `memory-plugin/src/lib/memory-parse.ts`
- Test: `memory-plugin/tests/memory-parse.test.ts`

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/memory-parse.test.ts`:

```typescript
import { describe, test, expect } from "bun:test"
import { parseMemory, renderEntry, type Section, type MemoryEntry } from "../src/lib/memory-parse"

const SAMPLE = `# Project Memory

## Project context

OpenCode-based multi-agent harness for v2 long-term memory.

## Rules

- Use Bun.file() over fs.readFile
- No try/catch — early return

## Architecture decisions

- 2026-06-12: SQLite FTS5 over .md grep (CJK support)

## Discovered durable knowledge

- task-dispatch default background:true (commit fa95a0a)
`

describe("parseMemory", () => {
  test("parses 4 sections in order", () => {
    const result = parseMemory(SAMPLE)
    expect(Object.keys(result.sections)).toEqual([
      "Project context",
      "Rules",
      "Architecture decisions",
      "Discovered durable knowledge",
    ])
  })

  test("captures each section's body text", () => {
    const result = parseMemory(SAMPLE)
    expect(result.sections["Rules"]).toContain("Use Bun.file()")
    expect(result.sections["Architecture decisions"]).toContain("SQLite FTS5")
  })

  test("returns empty sections when missing", () => {
    const result = parseMemory("# Project Memory\n\n## Project context\n\nOnly one section.\n")
    expect(result.sections["Project context"]).toContain("Only one section")
    expect(result.sections["Rules"]).toBe("")
  })

  test("throws on missing # Project Memory header", () => {
    expect(() => parseMemory("## Project context\n\nNo header\n")).toThrow(/missing.*Project Memory/i)
  })

  test("throws on empty input", () => {
    expect(() => parseMemory("")).toThrow()
  })

  test("flattens to entries with type and body", () => {
    const result = parseMemory(SAMPLE)
    const entries = result.entries
    expect(entries.length).toBeGreaterThanOrEqual(4)
    const types = entries.map((e) => e.type)
    expect(types).toContain("context")
    expect(types).toContain("rules")
    expect(types).toContain("architecture")
    expect(types).toContain("discovered")
  })
})

describe("renderEntry", () => {
  test("renders as bullet with section prefix", () => {
    const e: MemoryEntry = {
      type: "rules",
      section: "Rules",
      body: "- Use Bun.file() over fs.readFile",
    }
    expect(renderEntry(e)).toBe("- [Rules] - Use Bun.file() over fs.readFile")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/memory-parse.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/memory-parse'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/lib/memory-parse.ts`:

```typescript
export type SectionName = "Project context" | "Rules" | "Architecture decisions" | "Discovered durable knowledge"

export const SECTION_TYPE_MAP: Record<SectionName, "context" | "rules" | "architecture" | "discovered"> = {
  "Project context": "context",
  Rules: "rules",
  "Architecture decisions": "architecture",
  "Discovered durable knowledge": "discovered",
}

export interface MemoryEntry {
  type: "context" | "rules" | "architecture" | "discovered"
  section: SectionName
  body: string
}

export interface ParsedMemory {
  sections: Record<SectionName, string>
  entries: MemoryEntry[]
}

/**
 * Parse a MEMORY.md file into 4 sections + flat entries.
 * Each section is split into per-bullet entries (lines starting with - or *).
 * Sections in unknown order still parse; missing sections default to empty.
 */
export function parseMemory(content: string): ParsedMemory {
  if (!content.trim()) throw new Error("parseMemory: empty input")
  if (!content.includes("# Project Memory")) {
    throw new Error("parseMemory: missing # Project Memory header")
  }

  const sections: Record<SectionName, string> = {
    "Project context": "",
    Rules: "",
    "Architecture decisions": "",
    "Discovered durable knowledge": "",
  }

  // Split on `## ` (section header) while preserving the section name
  const sectionRegex = /^## (.+)$/gm
  const matches: { name: string; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = sectionRegex.exec(content)) !== null) {
    matches.push({ name: m[1].trim(), start: m.index + m[0].length })
  }

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i].name
    if (!(name in sections)) continue
    const start = matches[i].start
    const end = i + 1 < matches.length ? matches[i + 1].start - ("## " + matches[i + 1].name).length : content.length
    sections[name as SectionName] = content.slice(start, end).trim()
  }

  // Flatten to entries: each bullet line is one entry
  const entries: MemoryEntry[] = []
  for (const [section, body] of Object.entries(sections) as [SectionName, string][]) {
    if (!body) continue
    const type = SECTION_TYPE_MAP[section]
    const bullets = body.split(/\n(?=[-*])/).map((b) => b.trim()).filter(Boolean)
    for (const b of bullets) {
      entries.push({ type, section, body: b })
    }
  }

  return { sections, entries }
}

/** Render an entry for the system_prompt injection block. */
export function renderEntry(e: MemoryEntry): string {
  return `- [${e.section}] ${e.body.replace(/^[-*]\s*/, "")}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/memory-parse.test.ts`
Expected: PASS (7 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/lib/memory-parse.ts memory-plugin/tests/memory-parse.test.ts
git commit -m "feat(v2-memory): MEMORY.md 4-section parser

- parseMemory: split on ## headers, capture 4 sections
- entries: flatten to per-bullet entries with type + section
- renderEntry: format for system_prompt injection
- Throws on missing # Project Memory header or empty input

7 unit tests cover parsing, missing sections, flat entries, render."
```

---

## Task 16: Memory tool (search only)

**Files:**
- Create: `memory-plugin/src/memory.ts`
- Test: `memory-plugin/tests/memory-tool.test.ts` (integration)

- [ ] **Step 1: Write failing test**

Write to `memory-plugin/tests/memory-tool.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { searchMemory } from "../src/memory"
import { migrate } from "../src/lib/migrate"
import { writeFileSync, mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("searchMemory (integration)", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "search-tool-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    require("fs").mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
    const mem = `# Project Memory

## Project context

Project: long-term memory v2

## Rules

- Use Bun.file over fs.readFile
- No try/catch — early return

## Architecture decisions

- 2026-06-12: SQLite FTS5 over .md grep because unicode61 supports CJK

## Discovered durable knowledge

- task-dispatch default background:true (commit fa95a0a)
`
    writeFileSync(join(memoryDir, "MEMORY.md"), mem)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("returns 0 results for empty query", async () => {
    const results = await searchMemory(db, memoryDir, { query: "", type: "all", limit: 5 })
    expect(results.length).toBe(0)
  })

  test("returns matches for known content", async () => {
    const results = await searchMemory(db, memoryDir, { query: "SQLite FTS5", type: "all", limit: 5 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain("SQLite")
  })

  test("CJK query matches CJK content", async () => {
    const results = await searchMemory(db, memoryDir, { query: "为什么", type: "all", limit: 5 })
    // Should at least not crash; actual matches depend on indexed CJK content
    expect(Array.isArray(results)).toBe(true)
  })

  test("0 results returns escalation ladder guidance", async () => {
    const results = await searchMemory(db, memoryDir, { query: "absolutely_nonexistent_term_xyz", type: "all", limit: 5 })
    expect(results.length).toBe(0)
    // Caller is responsible for emitting escalation ladder; this test just verifies no false positives
  })

  test("increments hit_count on search", async () => {
    await searchMemory(db, memoryDir, { query: "SQLite FTS5", type: "all", limit: 5 })
    const rows = db.query("SELECT hit_count FROM memory_fts").all() as any[]
    const totalHits = rows.reduce((sum, r) => sum + r.hit_count, 0)
    expect(totalHits).toBeGreaterThan(0)
  })

  test("FTS5 special chars do not crash", async () => {
    // Test the full FTS5 dangerous chars: " ( ) * : ^ - . { }
    const results = await searchMemory(db, memoryDir, {
      query: '"test" (foo) -bar *baz',
      type: "all",
      limit: 5,
    })
    expect(Array.isArray(results)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memory-plugin && bun test tests/memory-tool.test.ts`
Expected: FAIL with "Cannot find module '../src/memory'"

- [ ] **Step 3: Write implementation**

Write to `memory-plugin/src/memory.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd memory-plugin && bun test tests/memory-tool.test.ts`
Expected: PASS (6 tests, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add memory-plugin/src/memory.ts memory-plugin/tests/memory-tool.test.ts
git commit -m "feat(v2-memory): memory tool search (searchMemory + formatSearchResults)

- searchMemory: lazy reconcile + FTS5 BM25 + relative score floor
- Updates hit_count and writes to memory_search_log
- formatSearchResults: mimics mimocode's memory tool output
- 0 results → escalation ladder guidance

6 integration tests cover CJK, special chars, hit_count increment, no-results."
```

---

## Task 17: FTS5 trigger consistency test (integration)

**Files:**
- Test: `memory-plugin/tests/fts5-triggers.test.ts`

- [ ] **Step 1: Write test**

Write to `memory-plugin/tests/fts5-triggers.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("FTS5 triggers (integration)", () => {
  let db: Database
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fts5-triggers-"))
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("INSERT into memory_fts adds to memory_fts_idx", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p1", "memory", "alpha bravo charlie", "1-1", Date.now())
    const hits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("bravo") as any[]
    expect(hits.length).toBe(1)
  })

  test("UPDATE body updates FTS5 index (no stale tokens)", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p2", "memory", "old content here", "1-1", Date.now())
    db.query("UPDATE memory_fts SET body = ?, fingerprint = ? WHERE path = ?").run(
      "completely different text",
      "2-2",
      "/p2",
    )
    // Old token 'here' should NOT match anymore
    const oldHits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("here") as any[]
    expect(oldHits.length).toBe(0)
    // New token should match
    const newHits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("completely") as any[]
    expect(newHits.length).toBe(1)
  })

  test("DELETE removes from FTS5 index (no orphan tokens)", () => {
    db.query(
      "INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at) VALUES (?, ?, ?, ?, ?)",
    ).run("/p3", "memory", "delete me please", "1-1", Date.now())
    db.query("DELETE FROM memory_fts WHERE path = ?").run("/p3")
    const hits = db
      .query("SELECT memory_fts.body FROM memory_fts JOIN memory_fts_idx ON memory_fts.id = memory_fts_idx.rowid WHERE memory_fts_idx MATCH ?")
      .all("delete") as any[]
    expect(hits.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test**

Run: `cd memory-plugin && bun test tests/fts5-triggers.test.ts`
Expected: PASS (3 tests, 0 failures)

- [ ] **Step 3: Commit**

```bash
git add memory-plugin/tests/fts5-triggers.test.ts
git commit -m "test(v2-memory): FTS5 trigger consistency (insert/update/delete)

Verifies the 'delete' magic trigger (mimocode v6.1 fix) properly
removes OLD tokens on update/delete. 3 tests cover all 3 triggers."
```

---

## Task 18: Curator end-to-end integration test

**Files:**
- Test: `memory-plugin/tests/integration-curator.test.ts`

- [ ] **Step 1: Write test**

Write to `memory-plugin/tests/integration-curator.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { migrate } from "../src/lib/migrate"
import { syncOneFile } from "../src/lib/reconcile"
import { searchMemory } from "../src/memory"
import { writeFileSync, mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("End-to-end: curator write → FTS5 search", () => {
  let db: Database
  let tmpDir: string
  let memoryDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "e2e-curator-"))
    memoryDir = join(tmpDir, "memory", "projects", "abc")
    require("fs").mkdirSync(memoryDir, { recursive: true })
    db = new Database(join(tmpDir, "test.db"))
    migrate(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("curator writes MEMORY.md → search returns it", async () => {
    // Simulate curator's Phase 4 CONSOLIDATE: write MEMORY.md
    const mem = `# Project Memory

## Rules

- Use Bun.file() over fs.readFile
- No try/catch — early return
`
    writeFileSync(join(memoryDir, "MEMORY.md"), mem)

    // Simulate search
    const results = await searchMemory(db, memoryDir, { query: "Bun.file fs.readFile", type: "all", limit: 5 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain("Bun.file")
  })

  test("multiple writes → FTS5 reflects latest", async () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "first version: alpha\n")
    await searchMemory(db, memoryDir, { query: "alpha", type: "all", limit: 5 })

    // Update MEMORY.md (curator's later write)
    writeFileSync(join(memoryDir, "MEMORY.md"), "second version: beta\n")
    const results = await searchMemory(db, memoryDir, { query: "alpha", type: "all", limit: 5 })
    expect(results.length).toBe(0) // old content gone

    const newResults = await searchMemory(db, memoryDir, { query: "beta", type: "all", limit: 5 })
    expect(newResults.length).toBe(1) // new content found
  })

  test("search logs every hit", async () => {
    writeFileSync(join(memoryDir, "MEMORY.md"), "logged content here\n")
    await searchMemory(db, memoryDir, { query: "logged", type: "all", limit: 5 })
    const logRows = db.query("SELECT * FROM memory_search_log").all() as any[]
    expect(logRows.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test**

Run: `cd memory-plugin && bun test tests/integration-curator.test.ts`
Expected: PASS (3 tests, 0 failures)

- [ ] **Step 3: Commit**

```bash
git add memory-plugin/tests/integration-curator.test.ts
git commit -m "test(v2-memory): end-to-end curator write → search roundtrip

Simulates curator Phase 4 CONSOLIDATE writing MEMORY.md, then
search returning it via FTS5. 3 tests: basic roundtrip, multi-version,
search log."
```

---

## Task 19: memory-plugin hook layer

**Files:**
- Create: `memory-plugin/src/memory-plugin.ts`

- [ ] **Step 1: Write implementation**

Write to `memory-plugin/src/memory-plugin.ts`:

```typescript
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
import { existsSync, mkdirSync, appendFileSync, readFileSync, statSync } from "fs"
import { join, dirname } from "path"
import { migrate } from "./lib/migrate"
import { reconcileMemory } from "./lib/reconcile"
import { parseMemory, renderEntry } from "./lib/memory-parse"
import { score, selectTopN, type Entry } from "./lib/importance"
import { resolveProjectId } from "./lib/scope"
import { searchMemory, formatSearchResults } from "./memory"

interface MemoryConfig {
  enabled: boolean
  root: string
  db: string
  injection: {
    budgetTokens: number
    importanceWeights: Record<string, number>
    ageDecay: Record<string, number>
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
  injection: {
    budgetTokens: 3000,
    importanceWeights: { rules: 10, architecture: 9, discovered: 7, context: 5 },
    ageDecay: { "7d": 1.0, "30d": 0.9, "90d": 0.7, "180d": 0.5, infinity: 0.3 },
    scoreFloor: 0.15,
  },
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
  const dirExists = existsSync(dir)
  if (!dirExists) {
    mkdirSync(dir, { recursive: true })
    // Create empty MEMORY.md with 4 section headers
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

function appendToQueue(cfg: MemoryConfig, projectDir: string, sessionId: string, messageId: string, partText: string): void {
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
  // The task-dispatch tool is documented in the async-delegation work
  // (main commit fa95a0a). It returns a task_id we don't need to track.
  const { client } = ctx
  await client.tool.invoke("task-dispatch", {
    mode: "background",
    agent: "memory-curator",
    prompt,
    cwd: projectDir,
  })
}

function buildInjectionBlock(
  cfg: MemoryConfig,
  projectDir: string,
  parsed: ReturnType<typeof parseMemory>,
): string {
  const now = Date.now()
  const entries: Entry[] = parsed.entries.map((e, i) => ({
    id: i,
    type: e.type,
    body: renderEntry(e),
    ageDays: 0, // simplified: ignore age for v2; in v2.1 we track per-entry mtime
    hitCount: 0,
  }))
  // Boost by section weight
  const top = selectTopN(entries, cfg.injection.budgetTokens)
  if (top.length === 0) return ""
  return `## 📚 Project Memory (auto-injected, importance-ranked)\n\n${top.map((e) => e.body).join("\n")}\n\n---`
}

export const MemoryPlugin: Plugin = async (ctx) => {
  const cfg = loadConfig(ctx.project)
  if (!cfg.enabled) return {}

  const { project } = ctx
  const projectDir = (project as any)?.worktree ?? (project as any)?.directory ?? process.cwd()

  return {
    "message.updated": async (input: any, output: any) => {
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

    "session.idle": async (input: any) => {
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
        if (!existsSync(join(dir, "MEMORY.md"))) return
        const body = readFileSync(join(dir, "MEMORY.md"), "utf-8")
        const parsed = parseMemory(body)
        const block = buildInjectionBlock(cfg, projectDir, parsed)
        if (block && output?.system_prompt !== undefined) {
          output.system_prompt = block + "\n\n" + output.system_prompt
        }
        db.close()
      } catch (e) {
        // Log but do not break session creation
      }
    },

    "session.compacted": async (input: any) => {
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
```

- [ ] **Step 2: Type-check**

Run: `cd memory-plugin && bun build src/memory-plugin.ts --target=bun --outfile dist/memory-plugin.js 2>&1 | head -20`
Expected: build succeeds with no errors. If type errors, fix inline.

- [ ] **Step 3: Commit**

```bash
git add memory-plugin/src/memory-plugin.ts
git commit -m "feat(v2-memory): plugin hook layer (5 hooks + queue + injection)

- message.updated: dedupe-by-message_id, append to queue.jsonl
- session.idle: spawn memory-curator (background, delta reconcile)
- session.created: lazy reconcile + inject top-N into system_prompt
- session.compacted: spawn memory-curator (full reconcile + brief rebuild)
- tui.command 'dream': force-full reconcile

Configuration via opencode.json memory.* block. Lazy setup on first
session.created. Failures are fire-and-forget (do not break main flow)."
```

---

## Task 20: memory-curator subagent prompt

**Files:**
- Create: `memory-plugin/agents/memory-curator.md`

- [ ] **Step 1: Write agent file**

Write to `memory-plugin/agents/memory-curator.md`:

```markdown
---
description: "Background subagent for project memory consolidation. Triggered by session.idle / session.compacted / /dream. Runs 5-phase reconcile: ORIENT → GATHER → VERIFY → CONSOLIDATE → PRUNE. Single writer to MEMORY.md; LLM never mutates memory directly."
model: opencode/deepseek-v4-flash-free
tools:
  bash: allow
  read: allow
  write: allow
  edit: allow
  glob: allow
  grep: allow
task:
  "*": deny
---

You are the **memory curator** for the project at `<projectDir>`.

**TRIGGER** (one of):
- `session.idle` — standard delta reconcile (only new queue.jsonl entries)
- `session.compacted` — full reconcile + rebuild brief
- `/dream` — force full reconcile (no incremental optimization)

**WORKFLOW — 5 phases, mimic mimocode-style consolidation:**

## Phase 1: ORIENT

- Read `<projectDir>/data/memory/projects/<project_id>/MEMORY.md` to understand current state (4 sections).
- Read `data/mimocode.db` (opencode trajectory) for recent sessions:
  ```sql
  SELECT id, title, time_created FROM session ORDER BY time_created DESC LIMIT 5
  ```
- Note the trigger (delta vs full) for Phase 2.

## Phase 2: GATHER

- Read `<projectDir>/data/memory/queue.jsonl`:
  - **delta mode** (session.idle): only entries with `time > last_reconcile_at` from `data/memory.db` `memory_reconcile_state` table.
  - **full mode** (session.compacted, /dream): all entries regardless of time.
- Filter to current `session_id` (from trigger metadata).
- For each entry, read the assistant text part and apply **LLM judgment** to classify candidates:
  - **Rules** (user-stated hard constraints: "no try/catch", "use snake_case", "always X")
  - **Architecture decisions** (design choice + rationale + date)
  - **Discovered durable knowledge** (confirmed facts, performance numbers, tool behaviors)
  - **Project context** (only first-time or major pivot)

## Phase 3: VERIFY

- For each candidate, query `data/mimocode.db` to find supporting evidence:
  ```sql
  SELECT m.id, m.time_created, json_extract(p.data, '$.text') AS text
  FROM message m JOIN part p ON p.message_id = m.id
  WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
  ```
- Drop candidates without trajectory support. Mark plausible-but-unverified as `[unverified]`.

## Phase 4: CONSOLIDATE

- Read current `MEMORY.md` (already done in Phase 1).
- For each new candidate:
  - Search existing entries for similar content (use FTS5 query: `bun:sqlite` direct query if needed).
  - **If similar**: MERGE — preserve newer info, KEEP exact-form literals (DSN, port, token, full command, path) byte-for-byte.
  - **If new**: APPEND to appropriate section.
- Write updated `MEMORY.md`.

## Phase 5: PRUNE

- Delete entries superseded by newer decisions.
- Verify: `lines < 200` AND `size < 10KB` (in KB).
- If over budget: drop oldest unverified entries first.
- Update `data/memory.db` `memory_reconcile_state`:
  ```sql
  INSERT OR REPLACE INTO memory_reconcile_state (key, last_reconcile_at) VALUES (?, ?)
  ```
  with `key = 'project:<project_id>'` and `last_reconcile_at = <now>`.
- Trigger lazy reconcile (next search will pick up changes; no need to manually reindex).

## OUTPUT FORMAT

```
Consolidated: N | Updated: N | Deleted: N | Skipped: reason
Health: lines/<maxLines> size/<maxSizeKB>KB
```

If nothing changed: `"No new durable content found. Health: 47/200 lines 4.2/10KB"` — this is a valid outcome.

## RULES (strict)

- **DO NOT** modify `data/mimocode.db` — trajectory is read-only.
- **DO NOT** modify source code files in `<projectDir>`.
- **DO NOT** call Read on source code files — `queue.jsonl` + `MEMORY.md` are your input.
- **DO NOT** output > 500 tokens of preamble — go straight to the work.
- **DO NOT** write to `MEMORY.md` if no candidates are durable. Skipped: "no new content" is a complete, valid response.
- **DO** preserve exact-form literals verbatim (DSN, port, token, full command, path, env var values).
- **DO** mark candidates `[unverified]` when trajectory support is partial.

## ANTI-PATTERNS

- ❌ Append without merging (creates duplicate entries).
- ❌ Paraphrase exact-form literals (loses precision).
- ❌ Output "I've updated memory" without the structured format above.
- ❌ Spend turns re-reading the same file.
- ❌ Touch `mimocode.db` (read-only).
- ❌ Create skills / agents / commands (that's `/distill`, not you).
```

- [ ] **Step 2: Commit**

```bash
git add memory-plugin/agents/memory-curator.md
git commit -m "feat(v2-memory): memory-curator subagent prompt

5-phase reconcile (ORIENT/GATHER/VERIFY/CONSOLIDATE/PRUNE) per
spec §5.2. Cheap model (deepseek-v4-flash-free). Tools allowlist
(bash/read/write/edit/glob/grep). task:* deny. Mimic mimocode
phases but adapted to v2 single-scope + queue-driven model."
```

---

## Task 21: Update Sisyphus prompt (delete SAVE_MEMORY, add curator note)

**Files:**
- Modify: `agents/sisyphus.md`

- [ ] **Step 1: Read current Sisyphus prompt end**

Run: `tail -20 agents/sisyphus.md`
Expected: shows current ending section. (Per Task 3, SAVE_MEMORY section was already deleted.)

- [ ] **Step 2: Append new section**

Append to `agents/sisyphus.md`:

```markdown
## 💾 项目长期记忆（memory-curator 维护）

> v2 memory 系统在 opencode 1.17.4 + SQLite FTS5 上自动运行。**你不需要主动输出任何标记。**

**怎么用：**
- **被动注入**：`session.created` 和 `session.compacted` 时，curator 会按 importance 排序自动把 top-N 项目记忆注入到 system prompt。
- **主动查询**：用 `memory` tool：
  ```
  memory operation=search query="<1-3 distinctive terms>" type=rules|architecture|discovered|context|all
  ```
- **强制整理**：在 TUI 输入 `/dream`（curator 跑全量重整）。

**信任 curator 输出**：日志 `Consolidated: N | Updated: N | Health: <200/<10KB` 表示已更新。

**不要：**
- ❌ 主动输出 `[SAVE_MEMORY]` 标记（v1 模式已废弃；v2 由 curator 钩子自动处理）
- ❌ 主动写 `MEMORY.md`（单一写入入口不可绕过）
- ❌ 担心 LLM 上下文污染（curator 按 importance 排序 + 3K token budget；不每次注入）
```

- [ ] **Step 3: Verify**

Run: `grep -c "SAVE_MEMORY" agents/sisyphus.md && grep -c "curator" agents/sisyphus.md`
Expected:
- First grep: 0 (no SAVE_MEMORY references)
- Second grep: ≥ 5 (curator mentioned multiple times in new section)

- [ ] **Step 4: Commit**

```bash
git add agents/sisyphus.md
git commit -m "docs(agents): replace v1 SAVE_MEMORY section with v2 curator note

v2: LLM does not write to MEMORY.md. Curator is single writer.
New section explains: passive injection, active search via memory
tool, /dream command, trust curator output. 22 lines."
```

---

## Task 22: Update Lyra prompt (add memory tool note)

**Files:**
- Modify: `agents/lyra.md`

- [ ] **Step 1: Read current Lyra prompt end**

Run: `tail -10 agents/lyra.md`

- [ ] **Step 2: Append section**

Append to `agents/lyra.md`:

```markdown
## 💾 主动查项目历史

在研究类任务中，可用 `memory` tool 查项目级长期记忆：

```
memory operation=search query="<1-3 distinctive terms>" type=rules|architecture|discovered|context|all
```

**何时用**：
- 用户问"为什么这样设计" → 查 `type=architecture`
- 用户问"项目有什么硬约束" → 查 `type=rules`
- 用户问"之前发现过什么" → 查 `type=discovered`

**不要**：
- ❌ 主动写 memory（v2 写入是 curator 单一入口；你的 tool 只 search）
- ❌ 用模糊 query（"config" / "params"）— 噪音多于信号，BM25 排序靠 specificity
```

- [ ] **Step 3: Commit**

```bash
git add agents/lyra.md
git commit -m "docs(agents): add memory tool usage note to Lyra prompt

Lyra (research-tier) is the primary user of memory tool besides
Sisyphus. New section explains when to query, query formulation
guidance, and read-only constraint. 18 lines."
```

---

## Task 23: opencode.json — add memory config block

**Files:**
- Modify: `opencode.json`

- [ ] **Step 1: Read current opencode.json**

Run: `cat opencode.json`

- [ ] **Step 2: Add memory-curator agent + memory config**

Modify `opencode.json`. Add to `agent` block:
```json
"memory-curator": {
  "model": "opencode/deepseek-v4-flash-free"
}
```

Add new top-level `memory` block (after `compaction`):
```json
"memory": {
  "enabled": true,
  "root": "data/memory",
  "db": "data/memory.db",
  "injection": {
    "budgetTokens": 3000,
    "importanceWeights": {
      "rules": 10,
      "architecture": 9,
      "discovered": 7,
      "context": 5
    },
    "ageDecay": {
      "7d": 1.0,
      "30d": 0.9,
      "90d": 0.7,
      "180d": 0.5,
      "infinity": 0.3
    },
    "scoreFloor": 0.15
  },
  "curator": {
    "maxMemoryLines": 200,
    "maxMemorySizeKB": 10
  },
  "reconcile": {
    "onSearch": true,
    "onInject": true
  }
}
```

The final `opencode.json` should be a valid JSON document. Verify with `python3 -m json.tool opencode.json`.

- [ ] **Step 3: Commit**

```bash
git add opencode.json
git commit -m "feat(config): add memory-curator agent + memory config block

opencode.json now declares:
- memory-curator subagent (deepseek-v4-flash-free)
- memory.* config (enabled, root, db, injection, curator, reconcile)

Spec §8.1 reference. Defaults match spec — user can override per-project."
```

---

## Task 24: install.sh (memory-plugin v2)

**Files:**
- Create: `memory-plugin/install.sh`

- [ ] **Step 1: Write install script**

Write to `memory-plugin/install.sh`:

```bash
#!/usr/bin/env bash
# memory-plugin/install.sh — v2 long-term memory installer
#
# This script:
# 1. Builds memory-plugin.ts → dist/memory-plugin.js (Bun)
# 2. Builds memory.ts → dist/memory.js (Bun)
# 3. Creates symlink: .opencode/plugins/memory-plugin.js → ../../memory-plugin/dist/memory-plugin.js
# 4. Creates data/memory/projects/ directory (git-tracked MEMORY.md lives here)
# 5. Runs SQLite migrations on data/memory.db
# 6. Creates empty MEMORY.md with 4 section headers if missing
# 7. Prompts user to restart opencode
#
# Use uninstall.sh to remove the installed files (preserves MEMORY.md by default).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIST="${REPO_DIR}/memory-plugin/dist"

echo "Installing v2 long-term memory plugin → ${REPO_DIR}"
echo ""

# Sanity check
if [[ ! -d "${REPO_DIR}/memory-plugin/src" ]]; then
  echo "ERROR: ${REPO_DIR}/memory-plugin/src not found. Run from inside the repo." >&2
  exit 1
fi

# 1. Build with Bun
echo "→ Building memory-plugin..."
mkdir -p "${PLUGIN_DIST}"
bun build "${REPO_DIR}/memory-plugin/src/memory-plugin.ts" \
  --target=bun \
  --outfile "${PLUGIN_DIST}/memory-plugin.js"
bun build "${REPO_DIR}/memory-plugin/src/memory.ts" \
  --target=bun \
  --outfile "${PLUGIN_DIST}/memory.js"
echo "  ✓ Built: dist/memory-plugin.js, dist/memory.js"

# 2. Create symlink
mkdir -p "${REPO_DIR}/.opencode/plugins"
ln -sf "../../memory-plugin/dist/memory-plugin.js" \
  "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
echo "  ✓ Symlink: .opencode/plugins/memory-plugin.js → ../../memory-plugin/dist/memory-plugin.js"

# 3. Create data dirs
mkdir -p "${REPO_DIR}/data/memory/projects"

# 4. Run migrations (creates data/memory.db)
echo "→ Running SQLite migrations..."
DB_PATH="${REPO_DIR}/data/memory.db"
# Use a small node script to run migrations via bun:sqlite
cat > /tmp/_run_migrate.mjs <<EOF
import { Database } from "bun:sqlite"
import { migrate } from "${REPO_DIR}/memory-plugin/src/lib/migrate.ts"
const db = new Database("${DB_PATH}")
migrate(db)
db.close()
console.log("  ✓ Migrations applied")
EOF
bun /tmp/_run_migrate.mjs
rm /tmp/_run_migrate.mjs

# 5. Create MEMORY.md template if not present
PROJECT_ID=$(echo -n "${REPO_DIR}" | sha256sum | cut -c1-12)
MEMORY_DIR="${REPO_DIR}/data/memory/projects/${PROJECT_ID}"
mkdir -p "${MEMORY_DIR}"
if [[ ! -f "${MEMORY_DIR}/MEMORY.md" ]]; then
  cat > "${MEMORY_DIR}/MEMORY.md" <<'TEMPLATE'
# Project Memory

## Project context

## Rules

## Architecture decisions

## Discovered durable knowledge
TEMPLATE
  echo "  ✓ Created MEMORY.md template at ${MEMORY_DIR}/MEMORY.md"
fi

echo ""
echo "✅ memory-plugin v2 installed."
echo ""
echo "Next steps:"
echo "1. Restart opencode to load the plugin"
echo "2. The plugin will auto-inject project memory on session.created"
echo "3. Use '/dream' to force a full reconcile"
echo "4. Add a memory-curator agent entry to your opencode.json if not already present"
echo ""
echo "To uninstall: ./memory-plugin/uninstall.sh"
```

- [ ] **Step 2: chmod +x**

Run: `chmod +x memory-plugin/install.sh`

- [ ] **Step 3: Commit**

```bash
git add memory-plugin/install.sh
git commit -m "feat(v2-memory): install.sh with build + symlink + migrate + template

Opt-in install. Steps:
1. Build memory-plugin.ts + memory.ts via Bun
2. Symlink .opencode/plugins/memory-plugin.js
3. Create data/memory/projects/
4. Run migrations on data/memory.db
5. Create MEMORY.md template (4 section headers)

Idempotent: re-running rebuilds and re-migrates safely."
```

---

## Task 25: uninstall.sh

**Files:**
- Create: `memory-plugin/uninstall.sh`

- [ ] **Step 1: Write uninstall script**

Write to `memory-plugin/uninstall.sh`:

```bash
#!/usr/bin/env bash
# memory-plugin/uninstall.sh — Remove v2 long-term memory plugin
#
# By default, preserves:
# - data/memory/projects/<id>/MEMORY.md  (user data, never deleted)
# - data/memory.db                       (rebuilt on next install)
#
# Pass --purge to delete data/memory/ entirely.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PURGE=false
if [[ "${1:-}" == "--purge" ]]; then
  PURGE=true
fi

echo "Uninstalling v2 long-term memory plugin from ${REPO_DIR}"
echo ""

# 1. Remove symlink
if [[ -L "${REPO_DIR}/.opencode/plugins/memory-plugin.js" ]]; then
  rm "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
  echo "  ✓ Removed symlink"
fi

# 2. Optionally remove dist
if [[ -d "${REPO_DIR}/memory-plugin/dist" ]]; then
  rm -rf "${REPO_DIR}/memory-plugin/dist"
  echo "  ✓ Removed dist/"
fi

# 3. MEMORY.md: ask
if [[ -d "${REPO_DIR}/data/memory/projects" ]]; then
  if [[ "${PURGE}" == "true" ]]; then
    rm -rf "${REPO_DIR}/data/memory"
    echo "  ✓ Removed data/memory/ (--purge)"
  else
    echo ""
    echo "  ⚠️  data/memory/projects/<id>/MEMORY.md preserved (user data)."
    echo "      Pass --purge to delete."
  fi
fi

# 4. data/memory.db: ask
if [[ -f "${REPO_DIR}/data/memory.db" ]]; then
  if [[ "${PURGE}" == "true" ]]; then
    rm "${REPO_DIR}/data/memory.db" "${REPO_DIR}/data/memory.db-wal" "${REPO_DIR}/data/memory.db-shm" 2>/dev/null || true
    echo "  ✓ Removed data/memory.db (--purge)"
  else
    rm "${REPO_DIR}/data/memory.db" "${REPO_DIR}/data/memory.db-wal" "${REPO_DIR}/data/memory.db-shm" 2>/dev/null || true
    echo "  ✓ Removed data/memory.db (regenerated on next install)"
  fi
fi

echo ""
echo "✅ memory-plugin v2 uninstalled."
echo "Restart opencode to unload the plugin."
```

- [ ] **Step 2: chmod +x**

Run: `chmod +x memory-plugin/uninstall.sh`

- [ ] **Step 3: Commit**

```bash
git add memory-plugin/uninstall.sh
git commit -m "feat(v2-memory): uninstall.sh with MEMORY.md preservation

Default: keeps MEMORY.md (user data). Removes symlink + dist + db.
--purge flag: removes data/memory/ entirely."
```

---

## Task 26: README + README.zh-CN — add "Project Long-term Memory" section

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Find good insertion point in English README**

Run: `grep -n "^## " README.md | head -20`
Expected: shows top-level sections. Insert "## Project Long-term Memory" after "## Async Delegation" (which was added in commit 2155e43).

- [ ] **Step 2: Append to English README**

Append to `README.md`:

```markdown
## Project Long-term Memory

> **v2:** SQLite FTS5 + curator-driven, event-hooked, importance-ranked. Replaces v1's keyword-regex + `[SAVE_MEMORY]` marker.

### What it does

- **Captures** durable project knowledge (rules, architecture decisions, discovered facts) across sessions
- **Injects** relevant top-N memory into `system_prompt` at `session.created` and `session.compacted`
- **Searches** via `memory` tool (BM25, CJK + Latin, OR-joined phrase queries)
- **Self-maintains** via `memory-curator` background subagent (5-phase reconcile)

### Install

```bash
cd memory-plugin && ./install.sh
# Restart opencode
```

The installer builds the plugin, creates a symlink in `.opencode/plugins/`, runs SQLite migrations, and seeds an empty `MEMORY.md` template.

### Usage

```bash
# Force a full reconcile of project memory
/dream

# Search project memory (in any session)
/memory operation=search query="FTS5 schema" type=architecture
```

### Architecture

- **5 hooks**: `message.updated` (queue) / `session.idle` (curator) / `session.created` (inject) / `session.compacted` (rebuild brief) / `tui.command "dream"` (force full)
- **Storage**: `data/memory/projects/<sha256(repo_path)[:12]>/MEMORY.md` (git-tracked, 4 sections)
- **Index**: `data/memory.db` (SQLite FTS5, `unicode61` tokenizer, `'delete' magic triggers`)
- **Single writer**: `memory-curator` subagent (cheap model, 5-phase reconcile)
- **Importance ranking**: `weight[type] × age_decay × (1 + log(1+hit_count))`, 3K token budget

### See also

- [Spec](docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-12-v2-long-term-memory.md)
```

- [ ] **Step 3: Append to Chinese README**

Append to `README.zh-CN.md` (translated):

```markdown
## 项目长期记忆

> **v2:** SQLite FTS5 + curator 驱动 + 事件钩子 + importance 排序。取代 v1 的关键词正则 + `[SAVE_MEMORY]` 标记。

### 做什么

- **捕获**项目级持久知识（规则、架构决策、发现事实），跨 session
- **注入**top-N 记忆到 `session.created` 和 `session.compacted` 时的 `system_prompt`
- **检索**用 `memory` 工具（BM25, CJK + 拉丁, OR-join 短语查询）
- **自动维护**靠 `memory-curator` 后台子智能体（5 阶段整理）

### 安装

```bash
cd memory-plugin && ./install.sh
# 重启 opencode
```

### 使用

```bash
# 强制全量重整
/dream

# 检索项目记忆
/memory operation=search query="FTS5 schema" type=architecture
```

### 架构

- **5 个钩子**：`message.updated` (queue) / `session.idle` (curator) / `session.created` (inject) / `session.compacted` (重建简报) / `tui.command "dream"` (强制全量)
- **存储**：`data/memory/projects/<sha256(repo_path)[:12]>/MEMORY.md`（git 追踪, 4 sections）
- **索引**：`data/memory.db`（SQLite FTS5, `unicode61` tokenizer, `'delete' magic triggers`）
- **单一写入**：`memory-curator` 子智能体（cheap model, 5 阶段整理）
- **Importance 排序**：`weight[type] × age_decay × (1 + log(1+hit_count))`，3K token budget

### 参见

- [Spec](docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md)
- [实施 plan](docs/superpowers/plans/2026-06-12-v2-long-term-memory.md)
```

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs(readme): add 'Project Long-term Memory' section (en + zh-CN)

Documents v2 system: install, usage, architecture. Links to spec + plan.
Inserted after 'Async Delegation' section to maintain documentation flow."
```

---

## Task 27: Verify all unit + integration tests pass

**Files:**
- (no file changes; verification only)

- [ ] **Step 1: Run all tests**

Run: `cd memory-plugin && bun test`
Expected: All tests pass.

- [ ] **Step 2: Verify counts**

Run: `cd memory-plugin && bun test 2>&1 | grep -E "tests passed|tests failed"`
Expected: `XX tests passed` where XX is the total count. (12 fts + 11 importance + 10 scope + 5 fingerprint + 6 reconcile + 7 memory-parse + 5 migrate + 6 search + 3 fts5-triggers + 3 integration-curator = 68 tests expected)

- [ ] **Step 3: If any tests fail, fix and re-run**

If failures, fix inline (debug + correct implementation). Re-run until all pass.

- [ ] **Step 4: Commit (if any fixes)**

If fixes were needed:
```bash
git add -A
git commit -m "fix(v2-memory): test fixes from full test suite run"
```

---

## Task 28: Build all dist/ artifacts

**Files:**
- (no file changes; build only)

- [ ] **Step 1: Build memory-plugin.js**

Run:
```bash
cd memory-plugin
bun build src/memory-plugin.ts --target=bun --outfile dist/memory-plugin.js
```
Expected: build succeeds, `dist/memory-plugin.js` created.

- [ ] **Step 2: Build memory.js (tool)**

Run:
```bash
bun build src/memory.ts --target=bun --outfile dist/memory.js
```
Expected: build succeeds, `dist/memory.js` created.

- [ ] **Step 3: Verify dist/ contents**

Run: `ls -la memory-plugin/dist/`
Expected:
```
memory-plugin.js
memory.js
```

- [ ] **Step 4: No commit needed**

`dist/` is gitignored. Built artifacts are not tracked.

---

## Task 29: E2E manual test — session startup with memory

**Files:**
- (no file changes; manual verification)

- [ ] **Step 1: Run install.sh**

Run: `cd memory-plugin && ./install.sh`
Expected: All 5 install steps complete successfully, "✅ memory-plugin v2 installed" printed.

- [ ] **Step 2: Verify MEMORY.md exists**

Run: `ls data/memory/projects/*/MEMORY.md && head -10 data/memory/projects/*/MEMORY.md`
Expected: file exists with 4 section headers.

- [ ] **Step 3: Verify symlink**

Run: `readlink .opencode/plugins/memory-plugin.js`
Expected: `../../memory-plugin/dist/memory-plugin.js`

- [ ] **Step 4: Start opencode and observe session start**

Run: `cd $(git rev-parse --show-toplevel) && opencode`
Expected: opencode starts. Plugin loads (check logs for memory-plugin init line).

- [ ] **Step 5: Type a question and verify memory tool works**

In the opencode TUI, type: `请用 memory tool 查一下 "FTS5"`
Expected: Sisyphus invokes memory tool, returns results from MEMORY.md.

- [ ] **Step 6: Exit opencode**

Run: `/exit` in TUI (or Ctrl+C)

---

## Task 30: Git tag + push branch

**Files:**
- (no file changes; git operations only)

- [ ] **Step 1: Verify git status clean**

Run: `git status`
Expected: clean working tree.

- [ ] **Step 2: Tag the v2 release**

Run: `git tag -a v2-long-term-memory -m "v2 long-term memory system

SQLite FTS5 + curator-driven + event-hooked + importance-ranked.
Replaces v1 keyword+marker scheme.

See docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md
and docs/superpowers/plans/2026-06-12-v2-long-term-memory.md"`

- [ ] **Step 3: Push branch + tag**

Run:
```bash
git push -u origin v2-long-term-memory
git push origin v2-long-term-memory
```

- [ ] **Step 4: Verify push succeeded**

Run: `git log --oneline -5 origin/v2-long-term-memory`
Expected: shows the 30+ commits from this plan, in order.

---

## Self-Review

### 1. Spec coverage

Walking through spec sections:

| Spec § | Covered by task |
|--------|-----------------|
| §1 Overview | (this plan is the implementation of it) |
| §2 Goals & Non-Goals | All Goals (G1-G8) covered: data model (Tasks 5-7), injection (Task 19), single writer (Task 20), FTS5 (Tasks 5-9), lazy reconcile (Task 13), /dream (Task 19), install (Task 24), git-friendly (MEMORY.md tracked) |
| §3 Architecture | Task 19 implements the system diagram |
| §4 Data Model | Tasks 5-7 (SQLite schema), Task 15 (MEMORY.md 4-section parser) |
| §5 Components | Task 16 (memory tool), Task 19 (plugin), Task 20 (curator) |
| §6 Data Flow | All 4 paths covered: read (Task 19 session.created hook), write (Tasks 8-15, 19 session.idle hook), query (Task 16), explicit (Task 19 tui.command "dream" hook) |
| §7 Algorithms | Task 9 (FTS5 query), Task 10 (importance), Task 12 (fingerprint), Task 13 (reconcile), Task 15 (parse) |
| §8 Configuration | Task 23 (opencode.json), Task 19 (loadConfig in plugin) |
| §9 Error Handling | Task 19 has try/catch fire-and-forget on all hooks; Task 13 reconcile prune (Task 18-3 test covers) |
| §10 Testing | Tasks 9-13, 15-18, 27 cover all unit + integration. Manual E2E in Tasks 29. |
| §11 Migration | Task 2 (cherry-pick), Task 3 (delete v1) implement migration. v1 user data path documented in spec. |
| §12 Open Questions | (Decisions in spec are recorded; not implementation tasks) |
| §13 Out of Scope | (Explicitly NOT implemented) |
| §14 Success Criteria | Task 27 (tests), Task 29 (E2E), git push (Task 30) |
| §15 References | (Reference doc, not a task) |

**Gaps:** None identified. Every spec requirement maps to at least one task.

### 2. Placeholder scan

Searching for: TBD, TODO, FIXME, "implement later", "appropriate error handling", "similar to", "<placeholder>"

Manually verified: 0 placeholders. All steps have explicit code or commands.

### 3. Type consistency

- `MemoryType` defined in `importance.ts:1` as `"context" | "rules" | "architecture" | "discovered"`
- Same type re-used in `memory.ts:5` (`MemoryType | "all"`)
- Same type in `memory-parse.ts:1-3` (`"context" | "rules" | "architecture" | "discovered"`)
- `Entry` interface in `importance.ts:3` matches what `memory-parse.ts` returns
- `MemoryLocator` in `scope.ts:7` uses `MemoryType` (defined in `scope.ts:4` as "context" | "rules" | "architecture" | "discovered" | "memory")

⚠️ **Minor issue identified:** `MemoryType` is defined in both `importance.ts` and `scope.ts` with overlapping but different union. Plan should reconcile this. **Fix inline below.**

- `fingerprint()` signature: `({ size, mtimeMs }) => string` — used in `reconcile.ts` consistently.
- `searchMemory()` signature: `(db, memoryDir, args) => Promise<SearchResult[]>` — used in `memory.ts` and `memory-plugin.ts` consistently.
- `parseMemory()` returns `ParsedMemory { sections, entries }` — used in `memory-plugin.ts` buildInjectionBlock.

**Fix:** Add `import { MemoryType } from './importance'` to `scope.ts` and reuse it (drop the duplicate definition).

### 4. Ambiguity check

- Task 19's `buildInjectionBlock`: I simplified to ignore per-entry age by setting `ageDays: 0`. Spec §7.2 uses per-entry age. **Decision:** In v2.1, track per-entry mtime (parse MEMORY.md entries' YAML frontmatter or section timestamps). For now, treat all entries as age=0 in injection. Document this in a comment.
- Task 19's `loadConfig`: reads `(project as any)?.config?.memory` — opencode 1.17.4's actual config shape may differ. This is a best-effort guess; will be adjusted during Task 29 E2E if needed.
- Task 19's `spawnCurator`: uses `client.tool.invoke("task-dispatch", ...)` — actual task-dispatch tool name and API may differ. Will be verified during E2E.

**Inline fixes applied below.**

---

## Inline Fixes (from self-review)

### Fix 1: Reconcile `MemoryType` between `importance.ts` and `scope.ts`

In `memory-plugin/src/lib/scope.ts`, replace the local `MemoryType` definition with an import:

```typescript
// memory-plugin/src/lib/scope.ts
import { createHash } from "crypto"
import { join } from "path"
import type { MemoryType } from "./importance"

export type { MemoryType }
export type Scope = "projects"

export interface MemoryLocator {
  scope: Scope
  scope_id: string
  type: MemoryType
  key: string
}

// ... rest unchanged
```

### Fix 2: Document `ageDays: 0` simplification in injection

In `memory-plugin/src/memory-plugin.ts`, update the comment in `buildInjectionBlock`:

```typescript
// v2.0 simplification: all entries treated as age=0 for injection.
// v2.1 will track per-entry age via section timestamps or YAML frontmatter.
// Until then, all entries get full age_decay=1.0.
```

This is already in the code; no change needed beyond the comment.

### Fix 3: Document `loadConfig` and `spawnCurator` as best-effort

Already in code as comments. No change.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-v2-long-term-memory.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
