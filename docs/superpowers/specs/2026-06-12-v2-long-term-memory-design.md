# v2 Project Long-term Memory — Design Spec

> **Date:** 2026-06-12
> **Status:** Approved (5-section design reviewed)
> **Scope:** Single implementation plan (focused)
> **Reference:** MiMo-Code (https://github.com/XiaomiMiMo/MiMo-Code) — adopted patterns from `packages/opencode/src/memory/`

---

## 1. Overview

v2 project long-term memory is a SQLite FTS5-backed, curator-driven system that captures and surfaces durable project knowledge across opencode sessions. It is built on opencode 1.17.4's plugin hook system (`message.updated` / `session.idle` / `session.created` / `session.compacted`) and the async-delegation subagent infrastructure introduced in main commits 722292f..2155e43.

The system replaces v1's keyword-regex-triggered `.md` injection with an event-driven, importance-ranked, FTS5-indexed design that eliminates the v1 P0 stream-pollution bug (caused by the `experimental.text.complete` chunked-stream hook) and the v1 P1 English-only trigger gap (caused by the Chinese-only regex in `KEYWORD_RE`).

The single writing entry point is the `memory-curator` background subagent. The LLM never writes to `MEMORY.md` directly; the curator is the only path that mutates state. This is the "LLM-as-signal, curator-as-writer" boundary that makes the system robust against stream-pollution and long-context LLM instability.

---

## 2. Goals & Non-Goals

### Goals

- **G1**: Persist project-level decisions, rules, architecture choices, and discovered knowledge across sessions, surviving compaction, restart, and main-branch sync.
- **G2**: Inject relevant memory into `system_prompt` at session start and after compaction, ranked by importance (type × age × access frequency).
- **G3**: Single writing entry point (`memory-curator`) — LLM never mutates `MEMORY.md` directly.
- **G4**: FTS5 full-text search with CJK + Latin support, OR-joined phrase queries, and BM25 ranking with relative score floor.
- **G5**: Lazy reconcile: any off-tool write to `MEMORY.md` is picked up on the next search via `fingerprint = size-mtimeMs` check.
- **G6**: Explicit `/dream` command for force-full reconcile.
- **G7**: opt-in install (independent `memory-plugin/` dir, softlink to `.opencode/plugins/`), preserving v1 install/uninstall hygiene.
- **G8**: `MEMORY.md` stays human-readable + git-diff-friendly; SQLite is the search index, not the source of truth.

### Non-Goals (Out of Scope for v2)

- **N1**: Cross-project memory (`global` scope) — user preferences stay in `AGENTS.md`.
- **N2**: Cross-tool memory import (`cc` scope importing Claude Code memory) — opt-out by design.
- **N3**: Session-level state persistence (`sessions/<sid>/checkpoint.md`, `notes.md`, `tasks/<id>/progress.md`) — opencode 1.17.4's existing `experimental.session.compacting` chain covers this.
- **N4**: Scheduled auto-`/dream` (e.g. mimocode's 7d auto-dream) — user-controlled + simplified.
- **N5**: Vector / semantic / embedding search — out of scope; FTS5 is the retrieval engine.
- **N6**: npm publish of the plugin — beta-stage, opt-in only via repo `memory-plugin/install.sh`.
- **N7**: LLM-driven direct write to `MEMORY.md` (no `[SAVE_MEMORY]` marker) — single-writer principle.
- **N8**: Token-budgeted injection at LLM-tool-result boundaries (only at `system_prompt`).

---

## 3. Architecture

### 3.1 System diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ opencode main engine (1.17.4)                                    │
│  - writes trajectory to data/mimocode.db                          │
│  - fires hooks: message.updated / session.idle /                │
│    session.created / session.compacted                           │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ memory-plugin (钩子 layer, lightweight)                           │
│                                                                  │
│  hooks:                                                          │
│  ├─ message.updated   → append assistant text → queue.jsonl      │
│  ├─ session.idle      → spawn background subagent                │
│  │                       task-dispatch(mode=background)          │
│  │                       target: memory-curator                  │
│  ├─ session.created   → FTS5 search → budgeted inject            │
│  │                       → system_prompt                         │
│  ├─ session.compacted → spawn curator                            │
│  │                       task-dispatch(mode=background)          │
│  │                       prompt: "rebuild brief + update MEMORY" │
│  └─ tui.command.execute "dream" → spawn curator                  │
│                                       prompt: "force full reconcile" │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ memory-curator (background subagent, cheap model)                 │
│  model: opencode/deepseek-v4-flash-free                           │
│  tools: bash, read, write, edit, glob, grep                      │
│  5 phases:                                                        │
│   1. ORIENT       — read mimocode.db (session/message),          │
│                     read MEMORY.md (current state)                │
│   2. GATHER       — read queue.jsonl (assistant text deltas)     │
│   3. VERIFY       — SQL query mimocode.db to cross-check         │
│                     candidates                                   │
│   4. CONSOLIDATE  — update MEMORY.md: merge / dedup /             │
│                     preserve-exact-form-literals                  │
│   5. PRUNE        — remove stale entries, run reconcile,         │
│                     verify < 200 lines / 10KB                    │
│  output format:                                                   │
│    "Consolidated: N | Updated: N | Deleted: N |                  │
│     Skipped: reason | Health: lines/<200 size/<10KB"            │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ data/memory/projects/<sha256(repo_path)[:12]>/MEMORY.md         │
│  4 sections: Project context / Rules /                            │
│              Architecture decisions / Discovered durable knowledge│
│  (single source of truth, git-friendly)                           │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ data/memory.db (SQLite, FTS5)                                    │
│  tables:                                                         │
│  - memory_fts        (path, scope, scope_id, type, body,         │
│                       fingerprint, last_indexed_at, hit_count)   │
│  - memory_fts_idx    (FTS5 virtual, body index,                  │
│                       unicode61 remove_diacritics 1)              │
│  - memory_search_log (memory_id, query, time)                    │
│  triggers:                                                       │
│  - memory_fts_ai (insert: idx insert)                            │
│  - memory_fts_ad (delete: idx 'delete' magic — mimocode v6.1     │
│                   fix, prevents stale token accumulation)        │
│  - memory_fts_au (update: idx delete + insert)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component summary

| Component | Type | Responsibility |
|-----------|------|----------------|
| `memory-plugin` | opencode plugin (TypeScript) | Hook layer; queue collection, spawn curator, inject on session start |
| `memory-curator` | background subagent | 5-phase reconcile: read trajectory + queue + MEMORY.md, write MEMORY.md |
| `memory` tool | opencode custom tool (Zod) | BM25 search over `memory_fts`; exposed to Sisyphus + Lyra + curator only |
| `data/memory.db` | SQLite + FTS5 | Search index, hit-count statistics, search audit log |
| `data/memory/projects/<id>/MEMORY.md` | Markdown | Single source of truth; 4 sections; human-readable; git-trackable |

### 3.3 Out-of-process data

- `data/mimocode.db` (opencode 1.17.4 trajectory DB) — **read-only** for curator; never modified. Verifies candidate facts.
- `~/.config/opencode/AGENTS.md` (per user) — user-level preferences. **Not** memory; lives outside this system by design.

---

## 4. Data Model

### 4.1 `MEMORY.md` structure

```markdown
# Project Memory

## Project context
（项目目标、领域、关键约束 — 首次创建时由 curator 填写；后续仅在明确变化时更新）

## Rules
（用户硬约束。例：no try/catch — early-return；use snake_case for fields；commit msg 中文）

## Architecture decisions
（重大设计选择 + 理由 + 日期。例：2026-06-12 — 选 SQLite FTS5 而非 .md grep，因 unicode61 支持 CJK 检索）

## Discovered durable knowledge
（跨 session 持久的事实。例：Bun.file() 读 .md 比 fs.readFile 快 30%；task-dispatch 默认 background:true）
```

**Section semantics** (mimocode-aligned, 4 sections, ordered by stability):

| Section | Stability | Curator write frequency | Example |
|---------|-----------|--------------------------|---------|
| `Project context` | Long-term | First-time + major pivot | "OpenCode-based multi-agent harness" |
| `Rules` | Long-term | When user states new rule | "no try/catch" |
| `Architecture decisions` | Long-term | When decision is made | "FTS5 over .md grep, because CJK" |
| `Discovered durable knowledge` | Medium-term | When fact is confirmed | "Bun.file() faster than fs.readFile" |

### 4.2 SQLite schema

```sql
-- 2026-06-12-v2-001-memory_fts (initial)
CREATE TABLE `memory_fts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `path` TEXT NOT NULL UNIQUE,
  `scope` TEXT NOT NULL DEFAULT 'projects',     -- v2 single-scope; reserved
  `scope_id` TEXT NOT NULL DEFAULT '',
  `type` TEXT NOT NULL,                          -- 'context' | 'rules' | 'architecture' | 'discovered'
  `body` TEXT NOT NULL,
  `fingerprint` TEXT NOT NULL,                   -- `${size}-${mtimeMs}`
  `last_indexed_at` INTEGER NOT NULL,
  `hit_count` INTEGER NOT NULL DEFAULT 0         -- v2: importance ranking
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

-- 2026-06-12-v2-002-search_log (audit + hit_count derivation)
CREATE TABLE `memory_search_log` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `memory_id` INTEGER NOT NULL REFERENCES `memory_fts`(`id`),
  `query` TEXT NOT NULL,
  `time` INTEGER NOT NULL
);

CREATE INDEX `memory_search_log_memory_id_idx` ON `memory_search_log` (`memory_id`);
CREATE INDEX `memory_search_log_time_idx` ON `memory_search_log` (`time`);

-- 2026-06-12-v2-003-reconcile_state (track last reconcile time for /dream cadence)
CREATE TABLE `memory_reconcile_state` (
  `key` TEXT PRIMARY KEY,
  `last_reconcile_at` INTEGER NOT NULL
);
```

**Trigger pattern note** (mimocode v6.1 fix): The `memory_fts_ad` trigger uses the FTS5 `delete` magic command (`INSERT INTO memory_fts_idx(memory_fts_idx, rowid, body) VALUES('delete', ...)`) instead of plain `DELETE FROM memory_fts_idx`. This is required for external-content FTS5 tables to actually remove OLD tokens. The plain `DELETE` pattern (used in earlier mimocode versions) is contentless-mode syntax misapplied to external-content mode, leaving stale tokens accumulating until vtab corruption. The v2 schema uses the correct pattern from the start.

### 4.3 File layout

```
project-root/
├── data/
│   ├── mimocode.db                          # opencode 1.17.4 trajectory (untouched)
│   ├── memory.db                            # v2: SQLite FTS5 (gitignored)
│   └── memory/
│       └── projects/
│           └── <sha256(repo_path)[:12]>/
│               └── MEMORY.md                # v2: 4 sections, single source of truth
├── memory-plugin/                           # v2: opt-in install dir (replaces v1)
│   ├── src/
│   │   ├── memory-plugin.ts                 # hook layer (≈350 LOC)
│   │   └── memory.ts                        # memory tool (≈80 LOC)
│   ├── dist/
│   │   ├── memory-plugin.js                 # built
│   │   └── memory.js                        # built
│   ├── agents/
│   │   └── memory-curator.md                # subagent prompt
│   ├── migration/
│   │   ├── 2026-06-12-v2-001-memory_fts.sql
│   │   ├── 2026-06-12-v2-002-search_log.sql
│   │   └── 2026-06-12-v2-003-reconcile_state.sql
│   ├── tests/
│   │   ├── fts-query.test.ts
│   │   ├── importance.test.ts
│   │   ├── scope.test.ts
│   │   ├── fingerprint.test.ts
│   │   └── reconcile.test.ts
│   ├── install.sh
│   ├── uninstall.sh
│   ├── README.md
│   ├── CHANGELOG.md
│   └── LICENSE
├── agents/
│   ├── sisyphus.md                          # UPDATED: replace SAVE_MEMORY section
│   ├── lyra.md                              # UPDATED: add memory tool note
│   └── hephaestus.md                        # UNCHANGED (no memory tool)
├── tools/
│   ├── src/
│   │   └── memory-dispatch.ts               # optional: helper for spawning curator
│   └── dist/
│       └── memory-dispatch.js
├── opencode.json                            # UPDATED: add memory config
├── .gitignore                               # UPDATED: ignore data/memory.db
├── install.sh                               # UPDATED: opt-in memory-plugin
└── README.md                                # UPDATED: add "Project Long-term Memory" section
```

---

## 5. Components

### 5.1 `memory-plugin` (hook layer)

**File:** `memory-plugin/src/memory-plugin.ts` (≈350 LOC, Bun-compiled)

**Hook implementations:**

| Hook | Trigger | Action |
|------|---------|--------|
| `message.updated` | Assistant message fully assembled (NOT chunk — opencode 1.17.4 fires this at the message level, not the streaming-part level; parts are stable by the time this hook fires) | If `part.type === "text"` and `role === "assistant"` and `message_id` is not already in `queue.jsonl` for this session, append `{session_id, message_id, part_text, timestamp}` to `data/memory/queue.jsonl`. Deduplication by `message_id` is mandatory: parts may update multiple times for the same message, and the queue must contain each message's final text exactly once. |
| `session.idle` | Sisyphus response complete, awaiting next user input | Call `task-dispatch(mode="background", agent="memory-curator", prompt="session.idle triggered; run standard 5-phase reconcile")` |
| `session.created` | New session opened (or resumed) | Run importance-ranked FTS5 search, build top-N, inject into `system_prompt` at fixed position (see §6.1) |
| `session.compacted` | `experimental.session.compacting` chain completed | Call `task-dispatch(mode="background", agent="memory-curator", prompt="rebuild brief + update MEMORY.md; signal that compaction occurred")` |
| `tui.command.execute` | User input matches `/dream` (regex) | Call `task-dispatch(mode="background", agent="memory-curator", prompt="force full reconcile; no incremental optimization")` |

**`session.created` injection position:** the plugin patches the initial `system_prompt` parts to include a new part at index 0:

```
## 📚 Project Memory (auto-injected, importance-ranked)

<top-N entries from MEMORY.md, score-sorted, ≤3000 tokens>

---
```

This position (top of system prompt) ensures the LLM sees memory before any user/task content, and LLM cache (Anthropic prompt-cache) keys the memory block as a stable prefix.

### 5.2 `memory-curator` (background subagent)

**File:** `memory-plugin/agents/memory-curator.md`

**Frontmatter:**
```yaml
---
description: "Background subagent for project memory consolidation. Triggered by session.idle / session.compacted / /dream. Runs 5-phase reconcile: ORIENT → GATHER → VERIFY → CONSOLIDATE → PRUNE."
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
```

**Body (prompt) — abbreviated form (full prompt in §7.4):**

```
You are the memory curator for project <project_id>.

TRIGGER: session.idle | session.compacted | /dream

WORKFLOW (5 phases, mimocode-inspired):

Phase 1 - ORIENT
  - Read <data>/mimocode.db session/message/part for current session
  - Read <data>/memory/projects/<project_id>/MEMORY.md (current state)

Phase 2 - GATHER
  - Read queue.jsonl (assistant text deltas since last curator run)
  - Extract candidate durable facts:
    * Architecture decisions (with rationale)
    * Rules (user-stated hard constraints)
    * Discovered knowledge (cross-session facts)
    * Project context (only first time)

Phase 3 - VERIFY
  - Cross-check candidates against mimocode.db (trajectory is authoritative)
  - Skip candidates not supported by trajectory

Phase 4 - CONSOLIDATE
  - Update <data>/memory/projects/<project_id>/MEMORY.md:
    * MERGE duplicates (don't append blindly)
    * PRESERVE EXACT-FORM LITERAL (DSN, port, token, full command, path)
    * KEEP entries to 1-3 lines
  - Trigger reconcile: reindex FTS5 index

Phase 5 - PRUNE
  - Remove entries superseded by newer decisions
  - Verify MEMORY.md < 200 lines / 10KB
  - Mark unverifiable [unverified]

OUTPUT FORMAT:
  Consolidated: N | Updated: N | Deleted: N | Skipped: reason
  Health: lines/<200 size/<10KB
  "No changes" is a valid outcome

RULES:
  - DO NOT modify mimocode.db (trajectory is read-only)
  - DO NOT modify source code files
  - DO NOT call Read on source files (queue.jsonl + MEMORY.md 是 input)
  - DO NOT output > 500 tokens of preamble — go straight to the work
```

**Why a separate subagent, not a Sisyphus task:**
- Decouples curator cost from main-agent context (Sisyphus is high-tier, expensive; curator uses `deepseek-v4-flash-free`, cheap)
- Allows the curator to run for 10+ minutes without polluting Sisyphus's working memory
- Aligns with the `task-dispatch(mode="background")` infrastructure added in main commit `fa95a0a`
- Single-purpose: the curator's prompt is fully dedicated to the 5-phase reconcile, not interleaved with user-task work

### 5.3 `memory` tool

**File:** `memory-plugin/src/memory.ts` (≈80 LOC, Bun-compiled)

**Tool definition:**
```typescript
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

export const MemoryTool = tool({
  description: "Search project MEMORY.md using BM25 over indexed sections. Use to recall project decisions, rules, architecture choices, and discovered knowledge. Queries are OR-joined and ranked by importance (type × age × access frequency).",
  args: {
    operation: z.enum(["search"]).default("search").describe("Memory operation (only search in v2)"),
    query: z.string().min(1).max(200).describe("1-3 distinctive terms (function name, task ID, exact phrase from a directive, a rare word). Avoid padding with generic words."),
    type: z.enum(["context", "rules", "architecture", "discovered", "all"]).default("all").describe("Filter by MEMORY.md section"),
    limit: z.number().int().min(1).max(20).default(5).describe("Max results (default 5)"),
  },
  async execute(args, ctx) {
    // 1. Lazy reconcile
    // 2. Build FTS5 OR-joined phrase query
    // 3. BM25 search with relative score floor (top × 0.15)
    // 4. Update hit_count for returned ids (write to memory_search_log)
    // 5. Format output: path | type | score | snippet
  },
})
```

**Agent exposure:**
- ✅ Sisyphus (main agent)
- ✅ Lyra (research-tier mid agent)
- ✅ memory-curator (this subagent, for dedup before writing)
- ❌ Hephaestus (CRUD-tier low agent, no memory tool — keeps task context lean)

The exposure list is encoded in `opencode.json` permissions:
```json
{
  "agent": {
    "sisyphus": { "memory": "allow" },
    "lyra":     { "memory": "allow" },
    "memory-curator": { "memory": "allow" },
    "hephaestus":     { "memory": "deny" }
  }
}
```

---

## 6. Data Flow

### 6.1 Read path — system_prompt injection

```
session.created 钩子 fires
  │
  ▼
memory-plugin reads data/memory/projects/<project_id>/MEMORY.md
  │
  ▼
Parse 4 sections → entries: [{section, content, type}, ...]
  │
  ▼
Apply importance ranking (§7.2) to each entry
  │
  ▼
Sort entries by score DESC
  │
  ▼
Accumulate top-N entries until cumulative token count ≤ 3000
  │
  ▼
Format as system_prompt part:
  ## 📚 Project Memory (auto-injected, importance-ranked)
  
  <each entry rendered as a 1-3 line bullet with section header>
  
  ---
  │
  ▼
Prepend to system_prompt parts array (index 0)
  │
  ▼
Opencode engine continues normal session flow
```

**Idempotency:** The injection happens once per `session.created`. If the session is resumed (same session_id), injection is skipped (mimic semantics: a session's memory was already injected when first opened).

### 6.2 Write path — curator 5-phase reconcile

```
message.updated 钩子 fires (assistant text part)
  │
  ▼
Append to data/memory/queue.jsonl:
  {"session_id": "...", "message_id": "...", "part_text": "...", "time": ...}
  │
  ▼
(... assistant continues working ...)

session.idle 钩子 fires (Sisyphus response complete)
  │
  ▼
memory-plugin calls task-dispatch(mode="background", agent="memory-curator")
  │
  ▼
memory-curator spawns in background (cheap model)
  │
  ├─ Phase 1: ORIENT
  │   - Read mimocode.db: `SELECT * FROM session WHERE id = ?`
  │   - Read mimocode.db: `SELECT * FROM message WHERE session_id = ?`
  │   - Read MEMORY.md (parse 4 sections)
  │
├─ Phase 2: GATHER
│   - Read queue.jsonl:
│     * session.idle trigger → delta (entries with timestamp > last_reconcile_at from memory_reconcile_state)
│     * session.compacted trigger → full (all entries in queue.jsonl, regardless of timestamp)
│     * /dream trigger → full (same as session.compacted)
│   - Read mimocode.db: query assistant text parts (cross-check; queue is fast-path)
│   - LLM judgment: classify candidates by section (rules / architecture / discovered / context)
  │
  ├─ Phase 3: VERIFY
  │   - For each candidate, SQL query mimocode.db to find supporting evidence
  │   - Drop candidates without supporting trajectory (mark [unverified] if plausible)
  │
  ├─ Phase 4: CONSOLIDATE
  │   - Read current MEMORY.md
  │   - For each new candidate:
  │     * Search MEMORY.md for similar existing entry (use FTS5 search)
  │     * If similar: UPDATE (merge, preserve newer info, KEEP exact-form literals)
  │     * If new: APPEND to appropriate section
  │   - Write updated MEMORY.md
  │
  └─ Phase 5: PRUNE
      - Delete entries superseded by newer ones
      - Re-verify: lines < 200, size < 10KB
      - Trigger reconcile: reindex FTS5 (or rely on lazy reconcile on next search)
  │
  ▼
Curator outputs:
  Consolidated: 3 | Updated: 1 | Deleted: 0 | Health: 47/200 lines 4.2/10KB
  │
  ▼
Curator terminates (background subagent cleanup)
```

### 6.3 Query path — memory tool

```
Sisyphus / Lyra calls memory tool:
  operation="search", query="keyword trigger why", type="architecture", limit=5
  │
  ▼
memory-plugin:
  1. Lazy reconcile: walk data/memory/projects/, check fingerprints
     - For each .md file, read size + mtime
     - If fingerprint differs from indexed: re-read body, UPSERT memory_fts row
     - Drop memory_fts rows whose path no longer exists
  │
  2. Build FTS5 query (see §7.1):
     - Tokenize: /[\p{L}\p{N}_]+/gu (Unicode letters/numbers/underscore)
     - Phrase-quote each token: "keyword" "trigger" "why"
     - OR-join: "keyword" OR "trigger" OR "why"
  │
  3. Run BM25 search:
     SELECT path, type, snippet(memory_fts_idx, 0, '<<', '>>', '...', 32) snippet, bm25(memory_fts_idx) score
     FROM memory_fts_idx
     JOIN memory_fts ON memory_fts.id = memory_fts_idx.rowid
     WHERE memory_fts_idx MATCH ?
       AND memory_fts.type = ?  -- if type != 'all'
     ORDER BY score
     LIMIT 15                  -- over-fetch 3x, capped at 50
  │
  4. Apply relative score floor:
     - topScore = rows[0].score (bm25 returns lower = better; negate to higher = better)
     - cutoff = topScore * 0.15
     - Keep rows where i == 0 OR score >= cutoff
     - Slice to limit
  │
  5. Update hit_count:
     - INSERT INTO memory_search_log (memory_id, query, time) for each result
     - UPDATE memory_fts SET hit_count = hit_count + 1 for each result
  │
  6. Format output:
     Found 3 matches (BM25-ranked, best first).
     A hit here is authoritative — use it even if a parallel/sibling query returned nothing.
     
     ### data/memory/projects/<id>/MEMORY.md
     Section: architecture, Score: 0.847
     ...<<keyword>> 方案选择原因...
     
     ### data/memory/projects/<id>/MEMORY.md
     Section: architecture, Score: 0.612
     ...
```

### 6.4 Explicit reconsolidate — `/dream`

```
User input: "/dream"
  │
  ▼
tui.command.execute 钩子 matches "/dream" (regex: ^/dream\b)
  │
  ▼
memory-plugin calls task-dispatch(mode="background", agent="memory-curator")
  prompt: "/dream triggered by user. Force full reconcile — no incremental optimization, walk all session messages, verify each candidate against trajectory."
  │
  ▼
Curator runs identical 5 phases, but:
  - Phase 2 GATHER: reads ALL queue.jsonl (not just since last run)
  - Phase 4 CONSOLIDATE: more aggressive dedup (considers all 200-line history)
  - Phase 5 PRUNE: stricter size budget (190 lines / 9KB target)
  │
  ▼
Output: "Full reconcile complete. Consolidated: 5 | Updated: 3 | Deleted: 2 | Health: 184/200 lines 8.9/10KB"
```

---

## 7. Algorithms

### 7.1 FTS5 query construction (port from mimocode `fts-query.ts`)

```typescript
// FTS5's MATCH grammar has its own operators and special characters
// (`"`, `(`, `)`, `*`, `:`, `^`, `-`, `.`, `{`, `}`). Passing a raw user
// string with any of these crashes the parser. Wrapping each token as a
// phrase and joining avoids the crash; OR-join keeps recall high.
//
// \p{L} includes CJK letters (added for CJK recall). Punctuation is
// stripped during tokenization; both query and indexed body see only
// alphanumeric runs.

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

**Why OR not AND:** AND-join required EVERY query word to appear in a document, so a single descriptive word the user added that wasn't in the stored text (e.g. "postgres database port 5433" — "database" absent) zeroed the whole query even when 6/7 tokens matched. OR lets BM25 rank by how many / how rare the matched tokens are; the caller applies a score floor to drop common-word-only noise.

**Why phrase-quote:** FTS5 special characters in the query string would crash the MATCH parser. Phrase-quoting each token turns it into a literal-word search that the parser cannot misread.

### 7.2 Importance ranking

**Formula:**

```typescript
score(entry) = weight[type] × age_decay(entry.age_days) × (1 + log(1 + hit_count))

where:
  weight = { context: 5, rules: 10, architecture: 9, discovered: 7 }

  age_decay(days):
    days < 7    → 1.0
    days < 30   → 0.9
    days < 90   → 0.7
    days < 180  → 0.5
    else        → 0.3

  hit_count: derived from COUNT(memory_search_log WHERE memory_id = entry.id)
```

**Weight rationale:**
- `rules: 10` (highest) — user-stated hard constraints; never decay semantically, only by age
- `architecture: 9` — major design choices; inform every implementation decision
- `discovered: 7` — confirmed facts; useful but not load-bearing
- `context: 5` (lowest) — project description; rarely changes; lowest recency value

**Age decay rationale:**
- `< 7 days` full weight — recent decisions are most likely still active
- `30 / 90 / 180 day` tiers — empirically chosen from mimocode / dremel research
- `> 180 days` × 0.3 — old entries likely superseded; still retrievable via search if explicitly needed

**Hit count rationale:**
- `(1 + log(1 + hit_count))` — log scaling prevents hot entries from dominating linearly
- Entry hit 1 time: `1 + log(2) = 1.69`
- Entry hit 10 times: `1 + log(11) = 3.46`
- Entry hit 100 times: `1 + log(101) = 5.63`
- This is a "frequently-recalled" signal, not a "this is the truth" signal

**Top-N accumulation:**

```typescript
function selectTopN(entries: Entry[], budgetTokens: number): Entry[] {
  const sorted = entries.sort((a, b) => b.score - a.score)
  const selected: Entry[] = []
  let tokens = 0
  for (const e of sorted) {
    const t = estimateTokens(e.content)  // ≈ content.length / 4
    if (tokens + t > budgetTokens) break
    selected.push(e)
    tokens += t
  }
  return selected
}
```

### 7.3 Lazy reconcile

**Trigger:** Before every FTS5 search (in `memory` tool, in `session.created` injection).

**Algorithm:**

```typescript
async function reconcileBeforeSearch(projectDir: string) {
  const memoryPath = path.join(projectDir, "data/memory/projects", projectId, "MEMORY.md")
  const stat = await fs.stat(memoryPath)
  const fingerprint = `${stat.size}-${stat.mtimeMs}`

  const indexed = db.prepare("SELECT fingerprint FROM memory_fts WHERE path = ?").get(memoryPath)
  if (indexed?.fingerprint === fingerprint) return  // up to date

  // Re-read and reindex
  const body = await fs.readFile(memoryPath, "utf-8")
  db.prepare(`
    INSERT INTO memory_fts (path, type, body, fingerprint, last_indexed_at)
    VALUES (?, 'memory', ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      body = excluded.body,
      fingerprint = excluded.fingerprint,
      last_indexed_at = excluded.last_indexed_at
  `).run(memoryPath, body, fingerprint, Date.now())
  // FTS5 trigger handles the index update
}
```

**Why lazy not push:** Curator writes to `.md` (source of truth). If we pushed every write into SQLite, we'd race the curator with concurrent reads. Lazy reconcile is single-writer (curator writes file, SQLite catches up on next read) and is idempotent (fingerprint check).

### 7.4 Curator 5-phase full prompt (memorandum)

The full prompt body lives at `memory-plugin/agents/memory-curator.md`. The phases are:

- **Phase 1 ORIENT** — Identify current project_id (from `data/memory/projects/`), read current `MEMORY.md`, list recent sessions in `mimocode.db` (`SELECT * FROM session ORDER BY time_created DESC LIMIT 5`).
- **Phase 2 GATHER** — Read `queue.jsonl` (delta or full, per trigger), filter to current session_id, classify each assistant text into one of: architecture-decision / rule / discovered-fact / project-context.
- **Phase 3 VERIFY** — For each candidate, query `mimocode.db` for the supporting user message and tool calls. Drop candidates with no trajectory support (mark `[unverified]` if plausible but unverified).
- **Phase 4 CONSOLIDATE** — Read current `MEMORY.md`. For each candidate, search for similar existing entry (FTS5 OR-join query). If similar: merge (keep newer info, preserve exact-form literals). If new: append to appropriate section.
- **Phase 5 PRUNE** — Delete entries superseded by newer ones. Verify `< 200 lines / 10KB`. Trigger reconcile (or rely on next search).

### 7.5 BM25 score floor

```typescript
const floorRatio = 0.15  // configurable in opencode.json memory.injection.scoreFloor
const topScore = results[0].score  // bm25 returns lower = better; we negate
const cutoff = topScore * floorRatio
return results.filter((r, i) => i === 0 || r.score >= cutoff).slice(0, limit)
```

**Why relative not absolute:** BM25 magnitudes are corpus-size-dependent. In a tiny corpus every score collapses toward 0 (low IDF), so any fixed absolute floor would wrongly wipe real hits. The `#1` result is always kept (a match is a match even when BM25 can't discriminate). The 0.15 default is from mimocode's empirical tuning on a ~80-document real memory corpus.

**Over-fetch:** SQL query fetches `limit * 3` (capped at 50) so the relative floor can trim common-word noise without starving the list when there ARE enough real hits.

---

## 8. Configuration

### 8.1 `opencode.json` (project root + `~/.config/opencode/opencode.json`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "sisyphus": {
      "model": "minimax-cn-coding-plan/MiniMax-M3"
    },
    "lyra": {
      "model": "opencode/deepseek-v4-flash-free"
    },
    "hephaestus": {
      "model": "opencode/deepseek-v4-flash-free"
    },
    "memory-curator": {
      "model": "opencode/deepseek-v4-flash-free"
    },
    "compaction": {
      "prompt": "You are an aggressive context compactor. ..."
    }
  },
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git",
    "plugins/orchestrator.js",
    "opencode-minimax-easy-vision-cli"
  ],
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
      "scoreFloor": 0.15,
      "overFetchMultiplier": 3,
      "overFetchCap": 50
    },
    "reconcile": {
      "onSearch": true,
      "onInject": true
    },
    "curator": {
      "maxMemoryLines": 200,
      "maxMemorySizeKB": 10,
      "consolidateOnIdle": true,
      "consolidateOnCompacted": true
    },
    "searchLog": {
      "retentionDays": 90
    }
  },
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 100000,
    "preserve_recent_tokens": 40000,
    "tail_turns": 1
  },
  "default_agent": "sisyphus",
  "mcp": {}
}
```

**Note:** The `memory` config block is opt-in. Setting `"enabled": false` disables all hooks, the curator spawn, and the memory tool. Useful for users on slow connections or for debugging.

### 8.2 Agent frontmatter summary

| Agent | memory tool | memory-curator spawn | Tools needed |
|-------|-------------|----------------------|---------------|
| sisyphus | ✅ allow | ❌ | memory, read, write, edit, glob, grep, task-dispatch |
| lyra | ✅ allow | ❌ | memory, read, write, edit, glob, grep, task-dispatch |
| hephaestus | ❌ deny | ❌ | read, write, edit, glob, grep (no memory) |
| memory-curator | ✅ allow | n/a (self) | bash, read, write, edit, glob, grep |

### 8.3 `memory` tool schema (Zod)

```typescript
{
  operation: "search",
  query: string (1-200 chars, 1-3 distinctive terms),
  type: "context" | "rules" | "architecture" | "discovered" | "all" (default "all"),
  limit: integer 1-20 (default 5)
}
```

### 8.4 `.gitignore` additions

```gitignore
# v2 memory system runtime data (regenerated)
data/memory.db
data/memory.db-journal
data/memory.db-wal
data/memory.db-shm
data/memory/queue.jsonl
```

Note: `data/memory/projects/<id>/MEMORY.md` is **git-tracked** (it is the source of truth and is the data the user wants versioned).

---

## 9. Error Handling

### 9.1 Failure modes and responses

| Failure | Detection | Response |
|---------|-----------|----------|
| `memory-plugin` load error (opencode startup) | Plugin init throws | opencode skips plugin; log WARN; rest of session works without memory |
| `queue.jsonl` write fails (disk full) | `fs.appendFile` throws | Log ERROR; curator will not see this delta; user can `/dream` to force full reconcile |
| `memory-curator` spawn fails (subagent infrastructure down) | `task-dispatch` returns error | Log ERROR; session continues; user can `/dream` later |
| `memory-curator` Phase 3 VERIFY finds no trajectory support | LLM judgment | Mark candidate `[unverified]`; if all candidates are unverified, log "no new durable content"; do not write |
| `memory-curator` writes `MEMORY.md` > 200 lines | Post-write size check | Phase 5 PRUNE removes oldest unverified entries until ≤ 200 |
| `memory-curator` writes `MEMORY.md` > 10KB | Post-write size check | Phase 5 PRUNE drops longest entries until ≤ 10KB |
| `data/memory.db` corrupted on read | SQLite open throws | Fall back to read-only `.md` parse for `session.created` injection; log WARN; user notified |
| FTS5 index drift (after manual `.md` edit) | Lazy reconcile fingerprint mismatch | Re-read file, UPSERT `memory_fts`, FTS5 trigger updates index |
| `memory` tool search returns 0 results | Empty result set | Output escalation ladder (mimocode pattern): "Try FEWER terms, Grep the dir, or use history tool for verbatim" |
| `session.created` injection overflow (memory > 3000 tokens all sections) | `selectTopN` accumulates | Take top-N until budget; rest stays in `.md` for later search |
| Concurrency: two curators spawn simultaneously | `task-dispatch` queue | task-dispatch already dedupes (background subagent token+sequence); see main commit `fa95a0a` |
| `task-dispatch` subagent never completes (infinite loop) | `task-dispatch` background timeout | task-dispatch has built-in `background_job` lifecycle (main commit `2155e43`); user can `task-cancel` from TUI |

### 9.2 Data integrity invariants

- **I1**: After any curator write, `MEMORY.md` ≤ 200 lines AND ≤ 10KB.
- **I2**: After any curator write, `MEMORY.md` still parses into 4 sections (no orphan content).
- **I3**: `memory_fts` rows always have `fingerprint` matching current disk `size-mtimeMs` (or are stale — lazy reconcile catches on next read).
- **I4**: `mimocode.db` is never modified by the memory system. Curator's prompt explicitly forbids this; `tools` allowlist (bash, read, write, edit, glob, grep) does not include any `mimocode.db` writer.

### 9.3 Recovery procedures

- **R1**: If `memory_fts` is corrupted, drop the table and re-run lazy reconcile — `MEMORY.md` is the source of truth, fully recoverable.
- **R2**: If `MEMORY.md` is corrupted (e.g. partial curator write), git checkout `MEMORY.md` — it is git-tracked.
- **R3**: If `data/memory.db` is deleted entirely, lazy reconcile recreates the index from `MEMORY.md`. Empty index = no degradation; next search creates it.
- **R4**: If curator misclassifies a candidate, user can manually edit `MEMORY.md`, commit, lazy reconcile picks up the change.

---

## 10. Testing Strategy

### 10.1 Unit tests (`memory-plugin/tests/*.test.ts`, Bun test)

| Test file | Coverage |
|-----------|----------|
| `fts-query.test.ts` | `buildFtsQuery` handles: empty string, single token, multi-token, CJK, punctuation-only, FTS5-special-chars (`"`, `*`, `(`, `)`, etc.), URLs, long queries (>200 chars) |
| `importance.test.ts` | `score()` formula: weight × age_decay × hit_count_log; boundaries (age exactly 7/30/90/180 days, hit_count 0/1/10/100); sort order |
| `scope.test.ts` | `parsePath`, `buildPath` for the single `projects` scope; rejects paths with `..`, absolute paths, empty scope_id |
| `fingerprint.test.ts` | `${size}-${mtimeMs}` generation; detects file change; detects no-change idempotency |
| `reconcile.test.ts` | Lazy reconcile: same fingerprint → no-op; different fingerprint → UPSERT; missing file → DELETE |
| `select-top-n.test.ts` | Top-N accumulation respects budgetTokens; entries below score-floor excluded; edge case: 0 entries, 1 entry, 1000 entries |
| `memory-parse.test.ts` | Parse 4 sections from valid `MEMORY.md`; reject malformed (missing section header, empty file, no `# Project Memory`); preserve order; handle Windows line endings |

### 10.2 Integration tests (Bun test, with real SQLite + tmp dir)

| Test | Setup | Assertion |
|------|-------|-----------|
| `curator-end-to-end.test.ts` | Mimic mimocode.db with 3 sessions, 5 messages; pre-existing MEMORY.md with 10 entries; queue.jsonl with 3 candidates | Run full 5 phases; assert MEMORY.md has merged entries, ≤ 200 lines, hit_count updated in `memory_fts`, search returns expected entries |
| `fts5-triggers.test.ts` | Create table, INSERT, UPDATE, DELETE on `memory_fts` | Verify `memory_fts_idx` rowid count matches; verify 'delete' magic removes old tokens (no stale accumulation) |
| `reconcile-lazy-sync.test.ts` | Write MEMORY.md → check FTS5 not yet indexed → call search → assert FTS5 has entry | Fingerprint mismatch triggers UPSERT in search path |
| `injection-budget.test.ts` | Create MEMORY.md with 50 entries | Run `session.created` injection path; assert system_prompt addition is ≤ 3000 tokens; assert top entries are higher-score (not random) |
| `memory-tool-search.test.ts` | Index 20 entries; query for known tokens | Assert BM25 ranking; assert snippet contains `<<` `>>` markers; assert hit_count incremented |
| `0-results-escalation.test.ts` | Empty memory_fts; query for non-existent | Assert output contains "Retry with FEWER terms" + "Grep the dir" + "history tool" guidance |

### 10.3 End-to-end tests (manual, with restart)

| Test | Procedure | Pass criteria |
|------|-----------|---------------|
| Session startup with memory | Open opencode, type a question about an architecture decision made in a prior session | LLM response includes the decision (proves injection worked) |
| Idle-triggered curator | Open session, send 3 messages, exit. Reopen, check `data/memory/projects/<id>/MEMORY.md` | MEMORY.md has new entries from the 3 messages; queue.jsonl is empty (drained) |
| `/dream` command | Type `/dream` in TUI | Background subagent spawns; output shows "Consolidated: N"; MEMORY.md updated |
| Compaction-triggered curator | Open session, force compaction (send 50+ messages until auto-compact), observe | Curator spawns; MEMORY.md updated; session continues with new compact prompt |
| Memory tool search | In session, call `memory` tool via Sisyphus with `query="keyword trigger why"` | Returns top-5 entries; LLM uses them in subsequent response |
| Disable + re-enable | Set `memory.enabled: false` in opencode.json, restart | No memory in system_prompt; `/dream` does nothing; `memory` tool errors; set back to `true`, restart → works again |
| Opt-in install | Fresh clone, do NOT run `memory-plugin/install.sh`; verify opencode starts without memory-plugin loaded | Plugin absent; no errors; `data/memory/` not created; no `memory.db` |

---

## 11. Migration from v1

### 11.1 State at start of v2

- v1's 4 unique commits (063990a..0d3790d) are on `archive/memory-plugin-v1-beta`, not merged to main.
- v1 README contains BETA warning; v1 install is opt-in via `memory-plugin/install.sh`.
- v1 data: `data/state_store.db/` is untracked git (was created during local testing).

### 11.2 Migration steps

1. **Create branch** `v2-long-term-memory` from main (2155e43):
   ```bash
   git checkout -b v2-long-term-memory main
   ```
2. **Cherry-pick** v1's 4 unique commits to the new branch:
   - `063990a feat(memory-plugin): independent BETA module with opt-in install`
   - `61b7e4e chore(install): auto-register memory-plugin + bump @opencode-ai/plugin to 1.17.3`
   - `f6b4c34 docs(agents): teach Sisyphus + AGENTS template to emit SAVE_MEMORY markers`
   - `0d3790d docs(readme): add memory-plugin as prominent opt-in new feature`

   Then revert/rewrite v1-specific files in subsequent commits (see §11.3).
3. **Delete v1 source** `.opencode/src/memory-plugin.ts` (v1 had this in `.opencode/`; v2 puts it in `memory-plugin/src/`).
4. **Delete v1 softlink** `.opencode/plugins/memory-plugin.js` (will be re-created by v2 install.sh).
5. **Delete v1 Sisyphus prompt section** `## 💾 长期记忆（memory-plugin 集成）`.
6. **Create v2 layout** per §4.3.
7. **Run install**: `cd memory-plugin && ./install.sh`.
8. **Verify E2E** (manual test 1 from §10.3).

### 11.3 v1-specific files to overwrite

| v1 file (cherry-picked) | v2 replacement |
|--------------------------|-----------------|
| `memory-plugin/src/memory-plugin.ts` (v1, 349 LOC, keyword + SAVE_MEMORY) | `memory-plugin/src/memory-plugin.ts` (v2, ~350 LOC, hooks + spawn curator) |
| `memory-plugin/install.sh` (v1, symlink) | `memory-plugin/install.sh` (v2, symlink + migrate + mkdir) |
| `agents/sisyphus.md` (v1 added SAVE_MEMORY section) | `agents/sisyphus.md` (v2 replaces with curator note, see §5.2) |
| `templates/AGENTS.md` (v1 added SAVE_MEMORY section) | `templates/AGENTS.md` (v2: no memory section; memory is opt-in) |
| `.opencode/package.json` (v1, 1.16.2 plugin) | `.opencode/package.json` (v2, 1.17.4 plugin) |
| `opencode.json` (no memory config in v1) | `opencode.json` (v2, with `memory` config block) |

### 11.4 v1 user data

- v1 `MEMORY.md` at project root — **deprecated** in v2. The v2 curator will not read it. User can manually copy entries to the new `data/memory/projects/<id>/MEMORY.md` if desired (one-time manual migration).
- v1 `data/state_store.db/` (untracked) — irrelevant; v2 uses `data/memory.db`.

### 11.5 Rollback

If v2 has issues post-deploy, user can:
1. `git checkout main` (revert branch)
2. `cd memory-plugin && ./uninstall.sh` (remove softlink + dist)
3. Re-run v1 install from archive: `git checkout archive/memory-plugin-v1-beta -- memory-plugin/ && cd memory-plugin && ./install.sh`

---

## 12. Open Questions

These are intentional v2 scope deferrals; resolved as "no" for now, can be revisited in v2.x:

- **OQ1**: Auto-schedule `/dream` (mimocode's 7d auto-dream)? — **NO** for v2; user-controlled only.
- **OQ2**: Cross-project `global` scope? — **NO**; user preferences stay in `AGENTS.md`.
- **OQ3**: `cc` scope (import Claude Code memory)? — **NO**; opt-out by design.
- **OQ4**: `sessions/<sid>/checkpoint.md` for session state? — **NO**; opencode 1.17.4's compaction chain covers this.
- **OQ5**: Vector / semantic search? — **NO**; FTS5 is sufficient and stays in scope.
- **OQ6**: `memory` tool `add` / `update` / `delete` operations? — **NO**; curator is single-writer. Search only in v2.
- **OQ7**: Scheduled cleanup of `memory_search_log` (90d retention)? — **YES**; handled in curator Phase 5 PRUNE.
- **OQ8**: Expose `memory` tool to Hephaestus? — **NO**; keeps its task context lean.
- **OQ9**: Direct DB inspection CLI (e.g. `bun run memory:list`)? — **MAYBE** for v2.1; not in v2.
- **OQ10**: Migration script for v1 `MEMORY.md` → v2 `data/memory/projects/<id>/MEMORY.md`? — **MANUAL**; documented in README.

---

## 13. Out of Scope (Non-Goals) — Restated

For clarity and review:

- Vector / semantic / embedding search
- Cross-project memory
- Cross-tool memory import (Claude Code, Codex, etc.)
- Session-level state persistence (covered by opencode compaction)
- LLM-driven direct write to `MEMORY.md`
- Token-budgeted injection at LLM-tool-result boundaries (only at `system_prompt`)
- npm publish of the plugin
- Multi-runtime support (Bun-only, mirroring v1)

---

## 14. Success Criteria

v2 is "done" when **all** of the following are true:

- **SC1**: All §10.1 unit tests pass.
- **SC2**: All §10.2 integration tests pass.
- **SC3**: All §10.3 E2E tests pass (manual verification).
- **SC4**: `data/memory/projects/<id>/MEMORY.md` is created automatically on first session start.
- **SC5**: After a session with ≥ 1 user/assistant exchange, `MEMORY.md` reflects ≥ 1 new entry in the correct section.
- **SC6**: A new session's `system_prompt` contains the memory block, ≤ 3000 tokens, top entries are the highest-scored.
- **SC7**: `memory` tool returns BM25-ranked results with snippet + path + score; 0 results trigger the escalation ladder.
- **SC8**: `git diff data/memory/projects/<id>/MEMORY.md` shows a clean, human-readable diff.
- **SC9**: `task-dispatch` background curator spawns within 5 seconds of `session.idle` and terminates within 60 seconds for typical workloads.
- **SC10**: Total curator cost per session is < 5K tokens (cheap model + small context).
- **SC11**: `mimocode.db` is read-only verified (no writes from any memory-system code path).
- **SC12**: README documents install, uninstall, `/dream`, and `memory` tool usage.

---

## 15. References

- MiMo-Code memory module (sparse-cloned to `/tmp/mimo-sparse/packages/opencode/src/memory/`):
  - `memory/fts.sql.ts` — table schema (Drizzle)
  - `memory/fts-query.ts` — FTS5 query builder
  - `memory/service.ts` — search algorithm with relative score floor
  - `memory/reconcile.ts` — lazy reconcile + fingerprint
  - `memory/paths.ts` — scope/path parsing
  - `agent/prompt/checkpoint-writer.txt` — 11-section writer prompt
  - `agent/prompt/dream.txt` — 5-phase dream prompt
  - `agent/prompt/distill.txt` — 6-phase distill prompt
  - `session/auto-dream.ts` — schedule-based auto-trigger (port to hook-based in v2)
  - `migration/20260515010000_memory_fts/migration.sql` — v1 FTS5 schema
  - `migration/20260521010000_memory_fts_v6/migration.sql` — v6 fix (id auto-increment)
  - `migration/20260521020000_memory_fts_triggers/migration.sql` — v6.1 fix ('delete' magic)
- opencode 1.17.4 plugin hooks (sparse-cloned to `/tmp/opencode-sparse/packages/opencode/src/`):
  - `tool/task.ts` — task-dispatch with `mode=background` (commit `fa95a0a`)
  - `background/job.ts` — BackgroundJob lifecycle (commit `2155e43`)
- v1 archive: `archive/memory-plugin-v1-beta` — 4 unique commits (063990a, 61b7e4e, f6b4c34, 0d3790d)
- Main async-delegation commits: 722292f..2155e43 (8 commits, see `git log main`)
- Compaction strategy: `docs/2026-06-11-compaction-strategy-340k.md`
- v1 OpenSpec change: `openspec/changes/refactor-memory-plugin-to-independent-dir/` (4 files, archived v1 work)
