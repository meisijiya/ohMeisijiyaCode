# myOpenCodeWithMEeee

> Custom **1 + 1 + 1 agent system** for opencode, with **3-tier model routing** (high / mid / low). Drawing design from [Pi Subagents](https://github.com/mattpocock/skills) (frontmatter nesting + bash safety) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), with [karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills) and [OpenSpec](https://github.com/Fission-AI/OpenSpec) integrations.

## v2 Architecture — 1 + 1 + 1 (depth=3)

```
┌──────────────────────────────────────────────────────────┐
│  Sisyphus (primary, high-tier)                           │
│  • Architecture + design decisions                       │
│  • Routes to Lyra or Hephaestus via 9-row intent table   │
│  • Owns OpenSpec, MCP routing, skill discovery           │
└─────┬───────────────────────────┬────────────────────────┘
      │                           │
      ▼                           ▼
┌─────────────────────┐    ┌───────────────────────────────┐
│ Lyra (mid-tier)     │    │ Hephaestus (low-tier)         │
│ • Complex code      │    │ • CRUD / atomic refactor      │
│ • Research          │    │ • Test boilerplate            │
│ • OpenSpec uses     │    │ • task: deny (叶子)            │
│ • Can delegate to ──┼───▶│   (can't spawn sub-agents)    │
│   Hephaestus        │    │ • bash safe-glob (no rm -rf /)│
└─────────────────────┘    └───────────────────────────────┘
```

**Strict depth=3 rule**: Hephaestus's `task: deny` is opencode's hard guarantee — the Task tool is **physically removed** from Hephaestus's available tools. No infinite recursion.

## What's Inside

| Layer | v1 → v2 | Notes |
|------|---------|-------|
| **Agents** | 2 (Sisyphus + Oracle) → **3** (Sisyphus + Lyra + Hephaestus) | 1+1+1 architecture |
| **Model tiers** | 1 (inherit) → **3** (high/mid/low) | User-configurable in `opencode.json` |
| **Tools** | 9 → **2** | `hashline-edit` + `task-dispatch` |
| **Skills** | 2 → **5** | + `grill-with-docs`, `diagnose`, `to-issues` (imported from mattpocock/skills) |
| **MCPs** | 1 (MiniMax) → **3** | + `@context7/mcp` + `@playwright/mcp` |
| **Tests** | 84 → **59** | 7 self-built tools deleted |

## Bring-in Principle

> **Lightweight + bring-in**: don't reinvent wheels; use opencode built-ins + MCPs; innovate in **prompts, routing, architecture**.

| v1 self-built tool | v2 replacement |
|-------------------|----------------|
| `web-search` | `mcp__MiniMax__web_search` |
| `image-inspect` | `mcp__MiniMax__understand_image` |
| `mermaid-render` | `webfetch` + skill prompt |
| `pr-reader` | `webfetch` + `gh` CLI |
| `context7-docs` | `@context7/mcp` |
| `playwright-browser` | `@playwright/mcp` |
| `atomic-commit` | `bash` + `git` + skill |
| `ast-search` | `grep` + LSP MCP |

## Kept Innovations

Two tools survived the v1 → v2 cut because they are **true innovations** that MCPs/built-ins can't replicate:

- **`hashline-edit`** — line + FNV-1a CID anchors prevent edit drift on long files (omO data 6.7% → 68.3%)
- **`task-dispatch`** — single explicit surface for Sisyphus to invoke, with **MCP proxy mode** (`mcp:<server>:<tool>`) and **agent dispatch mode**

## How It Integrates with opencode

This project is a **drop-in addition** to your existing opencode setup. It does **not** require any separate provider/MCP configuration — it reuses whatever you've already configured via opencode's `/connect` command and your `opencode.json`.

| What | Where it lives | How to configure |
|------|---------------|------------------|
| **Providers / API keys** | opencode's own `opencode.json` | `/connect` in TUI (or edit `opencode.json` directly) |
| **3-tier model assignment** | opencode's own `opencode.json` | `agent.sisyphus.model`, `agent.lyra.model`, `agent.hephaestus.model` |
| **MCP servers** (MiniMax, Context7, Playwright) | opencode's own `opencode.json` | `bash install.sh` (auto-registers Context7 + Playwright; MiniMax via `/connect`) |
| **3 agents** | This project, mirrored to `~/.config/opencode/agents/` | `bash install.sh` |
| **5 skills** | This project, mirrored to `~/.config/opencode/skills/` | `bash install.sh` |
| **2 custom tools** | This project, mirrored to `~/.config/opencode/tools/` | `bash install.sh` |
| **Orchestrator plugin** | This project, registered in your `opencode.json` | `bash install.sh` (auto-registers) |
| **OpenSpec integration** | This project, in `.opencode/skills/openspec-*` and `.opencode/commands/opsx-*` | `openspec init --tools opencode` |

Agents **omit the `model` field entirely**. opencode 1.16.2 rejects both `model: inherit` and `model: <placeholder>` — model assignment comes from `opencode.json` per-agent config. The orchestrator plugin validates the 3-tier config and warns if any tier is unassigned.

## Quick Start

```bash
# 1. Install (mirrors files to ~/.config/opencode/, auto-registers plugin + 2 MCPs)
bash install.sh

# 2. Configure 3-tier models in ~/.config/opencode/opencode.json
# Example:
#   "agent": {
#     "sisyphus":    { "model": "anthropic/claude-opus-4-20250514" },   # high
#     "lyra":        { "model": "anthropic/claude-sonnet-4-20250514" }, # mid
#     "hephaestus":  { "model": "anthropic/claude-haiku-4-20250514" }   # low
#   }

# 3. Start opencode
opencode

# 4. Press [TAB] to cycle: build → sisyphus → lyra → hephaestus → ...
```

## Repository Layout

```
myOpenCodeWithMEeee/
├── agents/
│   ├── sisyphus.md          # primary (high-tier) — 6 XML segments + 9-row routing
│   ├── lyra.md              # subagent (mid-tier) — can delegate to Hephaestus
│   └── hephaestus.md        # subagent (low-tier) — task:deny, bash safe-glob
├── skills/
│   ├── karpathy-guidelines/ # import: multica-ai/andrej-karpathy-skills
│   ├── openspec-integration/# local: routing bridge to OpenSpec commands
│   ├── grill-with-docs/     # import: mattpocock/skills
│   ├── diagnose/            # import: mattpocock/skills
│   └── to-issues/           # import: mattpocock/skills
├── tools/
│   ├── src/
│   │   ├── hashline-edit.ts          # true innovation (kept)
│   │   ├── hashline-tag.ts           # helper (kept, internal)
│   │   ├── task-dispatch.ts          # router + MCP proxy (rewritten)
│   │   └── *.test.ts                 # 59 tests passing
│   └── dist/                         # built artifacts (gitignored)
├── .opencode/
│   ├── src/orchestrator.ts           # 3-tier validation, karpathy injection
│   └── plugins/orchestrator.js       # built artifact
├── docs/
│   ├── 2026-06-10-1plus1plus1-agent-system-design.md  # v2 design spec
│   ├── 2026-06-10-v2-migration-plan.md                # v2 implementation plan
│   └── 2026-06-09-1plus1-agent-system-design.md       # v1 design (archived)
├── install.sh        # idempotent installer
└── uninstall.sh      # idempotent uninstaller
```

## Routing Logic (in Sisyphus's prompt)

| Intent | Trigger | Route | Tier | OpenSpec |
|-------|---------|-------|------|----------|
| ARCHITECTURE | major architecture decisions | self | high | yes |
| DESIGN | new feature design | self | high | yes |
| COMPLEX_CODE | cross-file new feature | **Lyra** | mid | yes |
| RESEARCH | investigation, docs | **Lyra** | mid | no |
| DEBUG_HARD | complex bug | **Lyra** | mid | no |
| DEBUG_SIMPLE | obvious bug | self | high | no |
| CRUD | repetitive write | **Hephaestus** | low | no |
| ATOMIC_REFACTOR | mechanical refactor | **Hephaestus** | low | no |
| TEST_BOILERPLATE | test scaffolding | **Hephaestus** | low | no |

**Key insight**: **reasoning complexity** (not file count) decides the tier.

## Verification

```bash
# Tests (59 pass, 0 fail)
cd tools && bun test

# Typecheck
cd tools && bun run typecheck    # 0 errors

# Build
cd tools && bun run build        # 3 .js + 2 .test.js

# Install (mirrors + auto-registers plugin + 2 MCPs)
bash install.sh

# opencode.json MCPs
python3 -c "import json; c=json.load(open('$HOME/.config/opencode/opencode.json')); print(list(c['mcp'].keys()))"
# ['MiniMax', 'Context7', 'Playwright']
```

## Uninstall

```bash
bash uninstall.sh   # removes all 3 agents, 5 skills, 2 tools, 1 plugin, deregisters 2 MCPs
```

## License

MIT