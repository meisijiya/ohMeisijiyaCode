---
name: source-driven-development
description: Ground every framework/API decision in official documentation. Use `ctx7 docs <libraryId> <query>` to verify version-specific behavior, cite sources, flag unverified claims. Triggers when: implementing with a framework/API, the user mentions a specific library version, behavior differs from training, or you need to confirm an API signature.
license: MIT
metadata:
  source: "addyosmani/agent-skills"
  sourceUrl: "https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md"
  lightweight: "true (verifies the principle, doesn't import the full skill)"
  trigger: "Lyra/Sisyphus about to use a non-trivial library API or uncertain framework behavior"
  importedBy: "ohMeisijiyaCode v2.x"
  apiBudget: "Context7 free tier: 1000 calls/month (~33/day). Don't waste."
---

# Source-Driven Development (Lightweight)

## Core Principle

> **Ground every framework/API decision in official documentation. Verify, cite sources, flag what's unverified.**

In a long-context agent session, training-data memory degrades. The only reliable source is the official docs at the current version. Don't guess — fetch and cite.

## ⚠️ API Budget (Context7 free tier: 1000 calls/month)

**~33 calls/day budget.** Don't waste.

A single `ctx7 docs` call may fan out into multiple internal sub-calls. A 5-minute task that does 3 lookups already spends 9% of the daily budget. Reserve lookups for **genuinely uncertain** cases.

### When to query (DO)

- The user mentions a specific library version ("this is React 19")
- You're about to use an API that has changed recently (LLM cutoff risk)
- You can't predict the behavior from training memory
- The user explicitly asks "is this the right way?"
- An error message references specific API behavior (search the error)

### When NOT to query (DON'T)

- ✅ Well-known stable APIs (`Array.map`, `JSON.parse`, `fetch`, `Promise.all`) — **skip, use memory**
- ✅ Library you just successfully used 5 min ago in this session — **skip, cache the result**
- ✅ Standard patterns that haven't changed in 2+ years — **skip, memory is reliable**
- ✅ "I'm pretty sure this works" — **only query if committing to non-trivial code on it**
- ❌ "Let me look this up just to be safe" — **wastes calls**

### Cache pattern (within a single task)

```bash
# If you've already looked up "React 19 use server" in this session,
# DON'T look it up again. Reuse the result.
# If unsure, reuse your last successful ctx7 call and add a "verified earlier" note.
```

## The Process (3 steps)

### Step 1: Identify the library + version

Confirm `package.json` / `pyproject.toml` / etc. Don't assume latest.

### Step 2: Fetch official docs (use ctx7 CLI) — only if Step 1 is genuinely uncertain

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
- ❌ "Let me look up X again to be safe" when X was just verified
- ❌ Looking up the same library 3+ times in one task

## Anti-Rationalizations

| Excuse | Reality |
|--------|---------|
| "I know this API well" | LLMs have static cutoffs. Verify. |
| "Docs are slow to fetch" | Wrong docs = wrong code = slow rework. 5s fetch < 30min debugging. |
| "User said hurry up" | Hurry up with wrong code = slower. Verify in parallel with implementation. |
| "Better safe than sorry" | Wasting 1000 calls/month = paying for Context7 Plus. Pick your battles. |

## Verification

- [ ] `ctx7 docs` or `webfetch` was actually called (not from memory)
- [ ] Source URL/version is cited in the response
- [ ] If unable to verify, said "unverified — please check docs" instead of guessing
- [ ] Version-specific behavior flagged (e.g., "this is React 19 only")
- [ ] **Did NOT call ctx7 more than 2x per task** (cache within session)
