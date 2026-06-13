---
name: memory
description: Load this skill when you need to dispatch the memory-curator (after technical decisions, user says "remember this", or /dream), or to understand what's tracked in MEMORY.md. The plugin auto-injects MEMORY.md into your system prompt at every LLM call — no need to Read it yourself.
---

# Long-term Memory

This project tracks durable knowledge in `data/memory/projects/<hash>/MEMORY.md` (curator-maintained, ≤250 lines). The plugin auto-injects it into your **system prompt** at every LLM call, so it's already in your high-attention context (U-shape: system prompt = front = high attention).

## Don't Read MEMORY.md yourself

The plugin already injected it. Calling `Read` would put a duplicate in the message list (mid-context = LOW attention), wasting tokens and not improving recall.

## When to Dispatch Curator

Dispatch `memory-curator` when the user:

- Says **"remember this"**, **"记住"**, **"记下来"** → dispatch immediately
- Says **"/dream"** → dispatch immediately (the plugin's `tui.command.execute` hook also handles this)
- Has finished a major task / made a technical decision → dispatch at natural stopping points

**Don't dispatch on**:
- Trivial Q&A or back-and-forth debugging (let `session.idle` 15-turn counter handle it)
- Mid-task (let curator batch changes for efficiency)

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
