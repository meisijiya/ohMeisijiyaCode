---
name: memory
description: Load this skill at session start. The plugin handles WRITE path (queue.jsonl, curator dispatch, /dream). Your job: Read MEMORY.md in full once per session — it lands in the message list near the end of context (high attention region of U-shape curve). Then dispatch curator on natural decision boundaries.
---

# Long-term Memory

This project tracks durable knowledge in `data/memory/projects/<hash>/MEMORY.md` (curator-maintained, ≤250 lines). The plugin does NOT auto-inject it — that would rewrite the system prompt every turn and bust the LLM cache.

## Session Start — REQUIRED

1. `Read data/memory/projects/<hash>/MEMORY.md` in full (use `Read` tool, not search).
2. Note relevant context silently. Don't announce what you found.
3. If file doesn't exist yet (new project), the plugin will create it on first `session.created` event — proceed normally.

**Why Read, not plugin-inject:** the Read result lands in the message list near the end of context (high attention region of the U-shape curve). It's a one-time read per session — no per-turn cache busting. Plugin auto-injection would rewrite system_prompt every turn.

## When to Re-read MEMORY.md Mid-Session

Re-read when the situation actually demands it, not on every turn. Triggers:

- User references past work you don't remember ("as we discussed...", "the rule we set...")
- User asks "what do you know about X in this project?"
- A new technical decision is about to be made and you need to check for existing related rules
- About to dispatch `memory-curator` and want to verify current state first

**Do NOT re-read on**:
- Every user message (waste of tokens, context already has it)
- Simple clarification questions
- Tool execution that doesn't involve project history

## Persisting Knowledge — Curator Dispatch

Dispatch `memory-curator` when the user:

- Says **"remember this"**, **"记住"**, **"记下来"** → dispatch immediately
- Says **"/dream"** → dispatch immediately (the plugin's `tui.command.execute` hook handles this too)
- Has finished a major task / made a technical decision → dispatch at natural stopping points

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
