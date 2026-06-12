# v2 Long-term Memory — Test Pitfalls (2026-06-12)

> **Status:** v2 implementation abandoned. Design docs preserved for restart.
> **Branch:** `v2-long-term-memory` (pushed, tagged, but TUI broke).

---

## Pitfall 1: opencode 1.17.4 schema validator rejects custom top-level keys

**Symptom:** `opencode` startup error:
```
Configuration is invalid at /home/ljh2923/.config/opencode/opencode.json
Unrecognized key: memory
```

**Root cause:** opencode 1.17.4's `$schema: "https://opencode.ai/config.json"` only accepts known fields (`agent`, `plugin`, `compaction`, `default_agent`, `mcp`). Adding a custom `memory: { ... }` block at the top level causes a schema validation failure that **prevents opencode from starting**.

**Fix applied:** Removed the `memory` block from `~/.config/opencode/opencode.json`. Plugin now relies on **hardcoded DEFAULT_CONFIG** in `memory-plugin/src/memory-plugin.ts` (`DEFAULT_CONFIG = { enabled: true, root: "data/memory", ... }`).

**Lesson for v3:** Plugin-level config must live in the plugin's own directory (e.g., `memory-plugin/config.json`), NOT in opencode's JSON schema. Opencode's config is NOT extensible for plugins.

---

## Pitfall 2: Project-level `.opencode/opencode.json` is required for plugin-path resolution

**Symptom:** Running `opencode` in a bare directory (e.g., `/home/ljh2923/opencode-project/test-memory`) does not auto-load plugins. No `Plugin initialized` log. TUI starts but plugin silently absent.

**Root cause:** opencode's `loading path` sequence (logged at bootstrap):
```
loading path=/home/ljh2923/.config/opencode/config.json       ← global
loading path=/home/ljh2923/.config/opencode/opencode.json      ← global
loading path=/home/ljh2923/<cwd>/.opencode/opencode.json       ← PROJECT-LEVEL (missing!)
```
The `plugin` array entry `"plugins/memory-plugin.js"` is a **relative path** (resolves relative to the config file's directory OR the project directory — opencode docs are ambiguous). Without a project-level `.opencode/opencode.json`, the plugin path may fail to resolve.

**Fix attempted:** Created project-level `.opencode/opencode.json` manually + symlinked plugin into `.opencode/plugins/`. This fixed loading in the project root **but not** in arbitrary directories. The v1 install script (`c2dfa93`) handled this correctly by writing to `~/.config/opencode/opencode.json` AND copying the plugin to both global and project-level plugin dirs.

**Lesson for v3:** Plugin must be registered in **both** `~/.config/opencode/opencode.json` (global) **and** `<cwd>/.opencode/plugins/` (project). The v1 install.sh pattern (copy to both locations) is the correct approach; v2 install.sh was incomplete (only created project-local symlink).

---

## Pitfall 3: v2 plugin causes opencode TUI to fail to bootstrap (disposing after 6-7 seconds)

**Symptom:** After installing v2 plugin, `opencode` starts, writes a self-test marker (`.plugin-loaded-*`), then **disposes all instances** after 6-7 seconds. No `Plugin initialized` log. TUI never renders visible text (only escape codes in output capture).

**Timeline evidence from `~/.local/share/opencode/log/opencode.log`:**

| Timestamp (UTC) | Event |
|-----------------|-------|
| 13:23:06 | `creating instance` in myOpenCodeWithMEeee **→ Plugin initialized ✅** (pre-v2 marker code) |
| 13:30:12 | `bootstrapping` myOpenCodeWithMEeee **→ no Plugin initialized ❌** (post-v2 marker code) |
| 13:30:18 | `disposing all instances` (6s later) |
| 13:35:31 | `bootstrapping` **→ disposing after 130s** (13:37:41) |
| 13:38:58 | `bootstrapping` **→ disposing after 56s** (13:40:54) |

**Plugin function is actually called:** Self-test markers were written (`data/memory/.plugin-loaded-*` — 3 files, 21:30:21 to 21:30:50 CST). The plugin's `MemoryPlugin(ctx)` function executes, writes the marker, and returns hooks. But opencode's **own** bootstrap never completes — it disposes before the TUI renders.

**Attempted fix:** Disabled the plugin (renamed symlinks to `.disabled`). **Unknown if TUI works without v2 plugin** because the test was cut short.

**Possible root causes (unconfirmed):**
- Plugin's `ensureSetup()` calls `migrate(db)` which does synchronous SQLite operations — may block opencode's bootstrap loop
- Plugin's `database` module import (`import { Database } from "bun:sqlite"`) may conflict with opencode's own SQLite usage (file locks)
- `data/memory.db` file-lock contention between opencode's internal DB and the plugin's explicit `new Database("data/memory.db")`
- The plugin's marker write uses `require("fs")` — dynamic require inside a plugin may cause issues in Bun's module loader

**Lesson for v3:** The plugin's **initialization path** (before returning hooks) must be **completely non-blocking**. Any sync I/O (SQLite migration, file writes) during plugin init is a risk. Move all heavyweight work to **hook callbacks** (which run after bootstrap is complete). Specifically:
- `migrate(db)` + `new Database(...)` → lazy-init on first `session.created` hook, NOT in the plugin constructor
- `writeFileSync(marker)` → remove entirely (it was a debug artifact)
- All `import` statements that pull in heavy deps → verify they don't cause module load hangs

---

## Pitfall 4: `~/.config/opencode/opencode.json` must be valid JSON at all times

**Symptom:** opencode startup blocks silently if `opencode.json` is invalid JSON or has unknown keys.

**Root cause:** `python3 -m json.tool` validation passed, but the schema validation (`$schema: "https://opencode.ai/config.json"`) is more strict — it rejects **any** unknown top-level key.

**Lesson for v3:** Always test with:
```bash
# Validate config
python3 -m json.tool ~/.config/opencode/opencode.json > /dev/null

# Start opencode with clean env
cd /path/to/project && timeout 15 opencode 2>&1 | head -5
# Watch for "Plugin initialized" in the log
tail -f ~/.local/share/opencode/log/opencode.log | grep -i plugin
```

---

## Pitfall 5: `bun:sqlite` Database constructor may conflict with opencode's internal DB

**Unconfirmed hypothesis:** opencode 1.17.4 uses its own SQLite database (in `data/mimocode.db` and potentially `data/memory.db`). The plugin creating a **separate** `new Database("data/memory.db")` connection may:
- Lock the file (SQLite allows multiple readers but only one writer)
- Conflict with opencode's internal migration system
- Cause deadlock if both opencode AND the plugin run migrations simultaneously

**Lesson for v3:** 
- Use a **different DB path** from opencode's internal databases (e.g., `data/memory-plugin.db`)
- Defer database creation to hook callbacks, not plugin init
- Consider using a **single** shared database (if opencode exposes its DB) rather than managing a separate SQLite file

---

## What Worked

Despite the TUI bootstrap failure, v2 code quality was good:

| Module | Tests | Status |
|--------|-------|--------|
| `fts-query.ts` | 12 | ✅ all pass |
| `importance.ts` | 11 | ✅ all pass |
| `scope.ts` | 10 | ✅ all pass |
| `fingerprint.ts` | 5 | ✅ all pass |
| `reconcile.ts` | 6 | ✅ all pass |
| `memory-parse.ts` | 7 | ✅ all pass |
| `migrate.ts` | 5 | ✅ all pass |
| `memory.ts` (tool) | 6 | ✅ all pass |
| FTS5 triggers | 3 | ✅ all pass |
| Curator E2E | 3 | ✅ all pass |
| **Total** | **73** | **0 fail** |

- SQLite schema (3 migrations) created correctly
- `install.sh` built + deployed symlinks correctly
- Self-test markers confirmed plugin function execution
- Spec + plan documents are well-structured

---

## Surviving Artifacts (after rollback)

| File | Contents |
|------|----------|
| `docs/superpowers/specs/2026-06-12-v2-long-term-memory-design.md` | 1055-line design spec (15 sections) |
| `docs/superpowers/plans/2026-06-12-v2-long-term-memory.md` | 3220-line implementation plan (30 tasks) |
| `docs/superpowers/specs/2026-06-12-v2-test-pitfalls.md` | This file |
| `v2-long-term-memory` branch (remote) | Full v2 source + 73 tests + dist artifacts |
| `v2-long-term-memory` tag | Snapshot of the branch |

---

## Suggested Approach for v3 (Restart)

1. **Start from main** (2155e43), NOT from v2-long-term-memory
2. **Keep** the 4 design docs listed above
3. **Rewrite** the plugin from scratch with these fixes:
   - Remove `memory` top-level key from opencode.json (keep config in `memory-plugin/config.json`)
   - Remove all sync I/O from plugin init (defer to hooks)
   - Use `data/memory-plugin.db` (not `data/memory.db`)
   - Keep plugin paths in BOTH global AND project-level locations
   - Test TUI bootstrap BEFORE implementing hooks (add a hook that just `console.log("hook fired")`)
4. **Port** the 6 lib modules (fts-query, importance, scope, fingerprint, reconcile, memory-parse) as they are (all 73 tests pass)
5. **Rewrite** the plugin hook layer (`memory-plugin.ts`) from scratch, starting with a single `session.created` hook that:
   - Writes a marker file (diagnostic)
   - Does NOT call `migrate()` or `new Database()` in plugin init
   - Calls `migrate()` lazily on first hook invocation
6. **Test early, test often** — verify TUI works before adding more hooks

---

## Quick Recovery Commands

```bash
# 1. Re-enable v2 plugin (if debugging)
mv .opencode/plugins/memory-plugin.js.disabled .opencode/plugins/memory-plugin.js
mv ~/.config/opencode/plugins/memory-plugin.js.disabled ~/.config/opencode/plugins/memory-plugin.js

# 2. Check TUI bootstrap log
tail -f ~/.local/share/opencode/log/opencode.log | grep -iE "plugin init|dispos"

# 3. Run v2 tests (set of 73, all pass)
cd memory-plugin && bun test

# 4. Rebuild after changes
cd memory-plugin && bun build src/memory-plugin.ts --target=bun --outfile dist/memory-plugin.js
```
