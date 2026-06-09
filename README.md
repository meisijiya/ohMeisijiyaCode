# myOpenCodeWithMEeee

> Custom 1-Main + 1-Sub agent system for opencode, drawing design from [oh-my-pi](https://github.com/can1357/oh-my-pi) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), with [karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills) and [OpenSpec](https://github.com/Fission-AI/OpenSpec) integrations.

## How it integrates with opencode

This project is a **drop-in addition** to your existing opencode setup. It does **not** require any separate provider/MCP configuration — it reuses whatever you've already configured via opencode's `/connect` command and your `opencode.json`.

| What | Where it lives | How to configure |
|------|---------------|------------------|
| **Providers / API keys** | opencode's own `opencode.json` | `/connect` in TUI (or edit `opencode.json` directly) |
| **MCP servers** (e.g. `MiniMax`) | opencode's own `opencode.json` | `mcp` field in `opencode.json` |
| **karpathy-guidelines** | This project, mirrored to `~/.config/opencode/skills/` | `bash install.sh` |
| **Sisyphus + Oracle agents** | This project, mirrored to `~/.config/opencode/agents/` | `bash install.sh` |
| **Orchestrator hook plugin** | This project, registered in your `opencode.json` | `bash install.sh` (auto-registers) |
| **Hashline Edit + Task Dispatch tools** | This project, mirrored to `~/.config/opencode/tools/` | `bash install.sh` |

Agents use `model: inherit` so they pick up whatever provider you've connected in opencode. The orchestrator plugin re-injects karpathy-guidelines + project `AGENTS.md` into every LLM call's system prompt — it doesn't add or replace any model configuration.

## Quick Start

```bash
# Install (mirrors files to ~/.config/opencode/ AND auto-registers orchestrator plugin)
bash install.sh
# or: ./install.sh (after chmod +x)

# In TUI: pick a model via /connect (or pre-configure in opencode.json)
opencode
# Then:  /connect  →  choose provider
# Then:  [TAB]  to switch to "sisyphus" or "oracle" agent

# Uninstall (removes files + unregisters plugin; preserves your /connect providers)
bash uninstall.sh
```

## What install.sh does

1. Copies `agents/*.md` → `~/.config/opencode/agents/`
2. Copies `skills/karpathy-guidelines/SKILL.md` → `~/.config/opencode/skills/karpathy-guidelines/`
3. Copies built tools (excluding tests/helpers) → `~/.config/opencode/tools/`
4. Copies `plugins/orchestrator.js` → `~/.config/opencode/plugins/`
5. **Appends `plugins/orchestrator.js` to the `plugin` array in `~/.config/opencode/opencode.json`** (idempotent — won't double-register)

It does **not** touch: providers, MCPs, `MiniMax` config, `compaction` settings, superpowers, or any other plugin you have installed.

## What uninstall.sh does

1. Removes all files this project created
2. **Removes `plugins/orchestrator.js` from `opencode.json`'s `plugin` array** (only if it was registered by install.sh)

It does **not** touch: providers, MCPs, other plugins, or anything else in your `opencode.json`.

## Structure

```
myOpenCodeWithMEeee/
├── agents/
│   ├── sisyphus.md              # Main agent (4-segment XML prompt, model: inherit)
│   └── oracle.md                # Sub agent (breadth-first read-only consultant, model: inherit)
├── tools/                       # Custom opencode tools (TypeScript + Bun)
│   ├── src/
│   │   ├── hashline-tag.ts      # FNV-1a CID computation
│   │   ├── hashline-tag.test.ts
│   │   ├── hashline-edit.ts     # LINE#CID-anchored edit tool
│   │   ├── hashline-edit.test.ts
│   │   └── task-dispatch.ts     # Sub-agent delegation wrapper
│   ├── package.json
│   ├── tsconfig.json
│   └── bun.lock
├── .opencode/
│   ├── src/orchestrator.ts      # Hook plugin: karpathy/AGENTS.md injection + keyword detection
│   ├── plugins/orchestrator.js  # Built output
│   ├── package.json
│   └── tsconfig.json
├── skills/
│   └── karpathy-guidelines/     # 4 coding principles (verbatim import, MIT)
├── docs/                        # Design spec + implementation plan
├── install.sh                   # Mirrors files + auto-registers plugin
└── uninstall.sh                 # Removes files + unregisters plugin
```

## Components (current state)

- ✅ 2 agents (Sisyphus main + Oracle sub)
- ✅ 2 custom tools (Hashline Edit + Task Dispatch)
- ✅ 1 hook plugin (karpathy + AGENTS.md injection + ultrawork/search keyword detection)
- ✅ 1 skill (karpathy-guidelines, 70 lines verbatim)
- ⏳ 7 remaining tools (AST/Web/Image/Mermaid/PR/Commit/Docs/Browser) — planned
- ⏳ 3 more skills (ultrawork/git-master/openspec-integration) — placeholders only
- ⏳ OpenSpec CLI integration — not yet installed

See `docs/` for full design and task breakdown.

## Reference Documents

- **Design spec**: `docs/2026-06-09-1plus1-agent-system-design.md`
- **Implementation plan**: `docs/2026-06-09-1plus1-agent-system.md`

## License

MIT
