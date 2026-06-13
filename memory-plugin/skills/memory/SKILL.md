---
name: memory
description: Load this skill at session start and whenever the user asks about project context, past decisions, established rules, or wants to persist knowledge. This project tracks durable knowledge in `data/memory/projects/<hash>/MEMORY.md` (curator-maintained, ≤250 lines). Reading it in full is the primary recall path. Use the `/dream` command to force a curator reconcile.
---

# Long-term Memory

This project tracks durable knowledge in `data/memory/projects/<hash>/MEMORY.md` (curator-maintained, ≤250 lines). A `memory-curator` subagent consolidates new knowledge after technical decisions. The plugin auto-truncates `queue.jsonl` after each curator dispatch.

## Session Start — REQUIRED

1. `Read data/memory/projects/<hash>/MEMORY.md` in full (use `Read` tool, not search).
2. Note relevant context silently. Don't announce what you found.
3. If file doesn't exist yet (new project), the plugin will create it on first `session.created` event — proceed normally.

**Don't search MEMORY.md.** It's small (≤250 lines, ~10KB). The whole file fits comfortably in your context.

## When to Re-read MEMORY.md Mid-Session

Re-read when the situation actually demands it, not on every turn. Triggers that warrant a re-read:

- User references past work you don't remember ("as we discussed...", "the rule we set...")
- User asks "what do you know about X in this project?"
- A new technical decision is about to be made and you need to check for existing related rules
- You are about to dispatch `memory-curator` and want to verify current state first

**Do NOT re-read on**:
- Every user message (waste of tokens, context already has it from session start)
- Simple clarification questions
- Tool execution that doesn't involve project history

## Persisting Knowledge — Curator Dispatch

Dispatch `memory-curator` when the user:

- Says **"remember this"**, **"记住"**, **"记下来"** → dispatch immediately
- Says **"/dream"** → dispatch immediately (the plugin's `tui.command.execute` hook handles this too)
- Has finished a major task / made a technical decision → dispatch at natural stopping points
- Wants to force a full reconcile → `/dream`

**Don't dispatch on**:
- Trivial Q&A or back-and-forth debugging (let `session.idle` 15-turn counter handle it)
- Mid-task (let curator batch changes for efficiency)
- When queue.jsonl is empty (curator will be a no-op anyway)

Dispatch pattern:

```
task(
  subagent_type: "lyra",
  description: "memory curator reconcile",
  prompt: "Reconcile data/memory/queue.jsonl into data/memory/projects/<hash>/MEMORY.md. Follow curator workflow in memory-plugin/agents/memory-curator.md."
)
```

**Trust the plugin's 15-turn auto-trigger for the common case.** Manual dispatch is for explicit user intent.

## Path Resolution

The hash in `data/memory/projects/<hash>/` is a 12-char SHA256 prefix of the absolute project path. To find it: `ls data/memory/projects/` and pick the single directory present.
