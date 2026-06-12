---
name: memory
description: Search and manage long-term project memory (FTS5 + curator). Use at session start or when user asks about project context, past decisions, or established rules.
---

# Project Memory Skill

## When to Activate

- **Session start**: Call `search_memory` to load project context
- **User asks**: "what do we know about X", "how did we decide Y", "what are the rules"
- **After establishing durable knowledge**: rules, architecture decisions, discovered facts → trigger curator

## search_memory Tool

```
search_memory(query="<keywords>", type="all", limit=5)
```

- `type`: `"rules"`, `"architecture"`, `"discovered"`, `"context"`, or `"all"`
- Results are BM25-ranked FTS5 full-text search
- If 0 results: retry with fewer/more distinctive keywords — FTS5 handles CJK, special chars

## Session Start Protocol

1. Call `search_memory(query="project context architecture rules", type="all")`
2. Review snippets for critical context
3. If empty, check `data/memory/projects/*/MEMORY.md` as fallback

## Curator Trigger Conditions

Dispatch `memory-curator` subagent in background when:
- User says "remember this" / "don't forget" / runs `/dream`
- A significant architectural decision is finalized
- New project rules are established
- Confirmed discoveries about tools/APIs/configurations

Trigger format:
```
task-dispatch with subagent_type: "lyra"
prompt: "<delta|full> reconcile in <projectDir>. Read queue.jsonl + MEMORY.md. Follow memory-curator workflow."
```

## Notes

- Memory stored at `data/memory/projects/<hash>/MEMORY.md` — prefer the tool over direct Read
- `/dream` command available for manual full reconcile
- Curator outputs `Consolidated: N | Updated: N | Deleted: N` format
