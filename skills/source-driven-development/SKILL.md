---
name: source-driven-development
description: Ground every framework/API decision in official documentation. Use `ctx7 docs <libraryId> <query>` to verify version-specific behavior, cite sources, flag unverified claims. Triggers when: implementing with a framework/API, the user mentions a specific library version, behavior differs from training, or you need to confirm an API signature.
license: MIT
metadata:
  source: "addyosmani/agent-skills"
  sourceUrl: "https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md"
  lightweight: "true (verifies the principle, doesn't import the full skill)"
  trigger: "Lyra/Sisyphus about to use a non-trivial library API or uncertain framework behavior"
  importedBy: "myOpenCodeWithMEeee v2.x"
---

# Source-Driven Development (Lightweight)

## Core Principle

> **Ground every framework/API decision in official documentation. Verify, cite sources, flag what's unverified.**

In a long-context agent session, training-data memory degrades. The only reliable source is the official docs at the current version. Don't guess — fetch and cite.

## When to Use

- Implementing with a non-trivial framework (Next.js, React, Vue, Svelte, etc.)
- The user mentions a specific library version ("this is React 19")
- Behavior in your training data might be outdated (LLM cutoff)
- You need to confirm an API signature, prop type, or config option
- The user explicitly asks "is this the right way?"

## The Process (3 steps)

### Step 1: Identify the library + version

Confirm `package.json` / `pyproject.toml` / etc. Don't assume latest.

### Step 2: Fetch official docs (use ctx7 CLI)

```bash
# Find library ID
ctx7 library "<library name>" "<query>"

# Query the docs
ctx7 docs "/<libraryId>" "<specific question>"
```

Or fall back to `webfetch` for the official docs URL if ctx7 is unavailable.

### Step 3: Cite the source in your response

```
Per [React 19 docs](https://react.dev/reference/rsc/use-server):
> "use server" must be at module top level
```

## Red Flags

- ❌ "I think this API takes X" without verification
- ❌ Recommending patterns from training memory when docs are 1 curl away
- ❌ Inventing config keys or prop names
- ❌ Skipping version checks ("this probably works in v2 too")

## Anti-Rationalizations

| Excuse | Reality |
|--------|---------|
| "I know this API well" | LLMs have static cutoffs. Verify. |
| "Docs are slow to fetch" | Wrong docs = wrong code = slow rework. 5s fetch < 30min debugging. |
| "User said hurry up" | Hurry up with wrong code = slower. Verify in parallel with implementation. |

## Verification

- [ ] `ctx7 docs` or `webfetch` was actually called (not from memory)
- [ ] Source URL/version is cited in the response
- [ ] If unable to verify, said "unverified — please check docs" instead of guessing
- [ ] Version-specific behavior flagged (e.g., "this is React 19 only")
