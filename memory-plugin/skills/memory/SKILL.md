---
name: memory
description: Search and manage long-term project memory (FTS5 + curator). Use when starting a new session, when the user asks about project context/decisions/rules, or when significant technical knowledge should be persisted.
---

# Project Memory Skill

## When to Activate

**MUST activate** in these scenarios:
- **Session start**: ALWAYS search memory first to understand project context
- **User asks**: "what do we know about X", "how did we decide Y", "what are the rules for Z"
- **After establishing new durable knowledge**: rules, architecture decisions, discovered facts → trigger curator
- **User says**: "remember this", "don't forget", "/dream"

## How to Search Memory

Use the `search_memory` tool:

```
search_memory(query="<keywords>", type="all", limit=5)
```

- `type` filter: `"rules"`, `"architecture"`, `"discovered"`, `"context"`, or `"all"`
- Results are BM25-ranked with snippets
- If 0 results: don't give up — retry with fewer/more distinctive keywords

## Session Start Checklist

1. Call `search_memory(query="project context architecture rules", type="all")`
2. Read any returned snippets for critical context
3. If empty, check `data/memory/projects/*/MEMORY.md` directly with Read

## When to Trigger Curator (Memory Consolidation)

Trigger curator (dispatch `memory-curator` subagent) when:
- User explicitly asks to remember something ("remember this rule...")
- A significant **architectural decision** is made and agreed upon
- New **project rules** are established
- **Discovered facts** about tools/APIs/configurations are confirmed
- User runs `/dream` command

To trigger curator: dispatch memory-curator as a background subagent with the prompt:
```
Project directory: <current project dir>
<delta or full> reconcile.
Read data/memory/queue.jsonl for recent content.
Read data/memory/projects/*/MEMORY.md for current state.
Follow the workflow defined in memory-plugin/agents/memory-curator.md.
```

Use **delta mode** (default, incremental) unless the user specifically wants **full mode** (/dream).

## After Curator Completes

- Curator outputs: `Consolidated: N | Updated: N | Deleted: N | Skipped: reason`
- MEMORY.md is updated automatically
- Next session will benefit from the new knowledge

## Important

- The `search_memory` tool queries FTS5 full-text index (not grep). It handles CJK, special chars, BM25 ranking.
- Memory files live at `data/memory/projects/<hash>/MEMORY.md` — but use the tool, don't read directly.
- `/dream` is always available for users who want a full manual reconcile.
