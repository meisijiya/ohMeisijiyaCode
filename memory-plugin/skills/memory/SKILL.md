---
name: memory
description: Load this skill at session start and whenever the user asks about project context, past decisions, established rules, tool/API/config discoveries, or wants to persist knowledge. This project has FTS5 long-term memory — searching it prevents re-litigation of settled decisions and hallucinated architecture. Do NOT skip: any session without memory context risks wrong choices.
---

# Long-term Memory

This project tracks durable knowledge in `data/memory/projects/<hash>/MEMORY.md` (FTS5-indexed). A memory-curator subagent consolidates new knowledge after technical decisions.

## Session Start

1. `search_memory(query="project context architecture rules", type="all")`
2. Review results. If 0 hits: `Read data/memory/projects/*/MEMORY.md`.
3. Note relevant context silently — you don't need to announce what you found.

## search_memory Tool

FTS5 BM25 full-text search. Call with:

```
search_memory(query="<keywords>", type="all", limit=5)
```

- `type`: `"all"` (default), `"rules"`, `"architecture"`, `"discovered"`, `"context"`
- Handles CJK, special chars. Results include relevance-scored snippets.
- 0 results = retry with fewer keywords. Does NOT mean content doesn't exist (try `Read`).

## Curator Dispatch

When user says "remember this", `/dream`, or a technical decision is finalized:

- Dispatch `memory-curator` (background, `subagent_type: "lyra"`).
- Prompt: `<delta|full> reconcile in <projectDir>. Read queue.jsonl + MEMORY.md. Follow curator workflow.`
- `/dream` = full mode (manual). Architecture decisions = full. Rules/discoveries = delta.
