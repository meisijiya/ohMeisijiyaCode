---
name: memory
description: Search and manage long-term project memory (FTS5 + curator). MUST invoke at session start or when user asks about project context, past decisions, established rules, or wants to persist knowledge. Do NOT skip — missing context causes wrong decisions.
---

# Project Memory

## Session Start (ALWAYS)

```
search_memory(query="project context architecture rules", type="all", limit=5)
```

Review results. If 0 hits: `Read data/memory/projects/*/MEMORY.md`.

## Tool: search_memory

FTS5 BM25 full-text search over durable knowledge.

- `query`: keywords (CJK OK, special chars OK)
- `type`: `"all"` | `"rules"` | `"architecture"` | `"discovered"` | `"context"`
- `limit`: default 5
- Returns snippets ranked by relevance

## Trigger Curator (consolidate to MEMORY.md)

Dispatch `memory-curator` subagent (background, `subagent_type: "lyra"`) when:
- User says "remember this" / "don't forget" / `/dream`
- Architecture decision finalized → `full` mode
- New rules established → `delta` mode
- Confirmed tool/API/config discovery → `delta` mode

Prompt: `<delta|full> reconcile in <projectDir>. Read queue.jsonl + MEMORY.md. Follow memory-curator workflow.`
