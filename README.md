# myOpenCodeWithMEeee

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![English](https://img.shields.io/badge/EN-English-blue)](./README.md)
[![中文](https://img.shields.io/badge/中文-Chinese-red)](./README.zh-CN.md)

> A lightweight opencode Agent system built on **[Superpowers](https://github.com/obra/superpowers)** (14 workflow orchestration skills) — featuring **1 + 1 + 1 architecture** + **3-tier model routing** (high / mid / low) + **CLI-first external capabilities**. Synthesizing ideas from [Pi Subagents](https://github.com/mattpocock/skills) (frontmatter nesting + bash safety), [Matt Pocock's diagnostic suite](https://github.com/mattpocock/skills), [karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills) (coding discipline), [OpenSpec](https://github.com/Fission-AI/OpenSpec) (spec-driven changes), [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (architecture inspiration), and [RTK](https://github.com/rtk-ai/rtk) (token compression).

---

## ⚡ One-Click Install

```bash
git clone https://github.com/meisijiya/myOpenCodeWithMEeee.git
cd myOpenCodeWithMEeee
bash install.sh
```

**The install script automates**:

| Automated Item | Details |
|---------------|---------|
| **3 agents** | `sisyphus.md` / `lyra.md` / `hephaestus.md` → `~/.config/opencode/agents/` |
| **6 skills** | karpathy-guidelines / openspec-integration / grill-with-docs / diagnose / to-issues / mmx-cli-usage |
| **2 tools** | `hashline-edit.js` / `task-dispatch.js` → `~/.config/opencode/tools/` |
| **1 plugin** | `orchestrator.js` auto-registered to `opencode.json`'s `plugin` array |
| **AGENTS.md template** | Only copied if you don't have a global `~/.config/opencode/AGENTS.md` (**never overwrites** your personal config) |
| **3 CLIs** | `mmx` / `ctx7` / `playwright-cli` — called via bash, token-efficient (no full DOM dump into context) |

> All operations are **idempotent** — re-running won't re-register anything.

### ⚠️ Edit AGENTS.md Template After First Install

`install.sh` copies `templates/AGENTS.md` to `~/.config/opencode/AGENTS.md` **only if it doesn't exist**. **The template has 3 placeholders** (each user's system is different) that you need to manually replace:

```bash
nano ~/.config/opencode/AGENTS.md
```

| Placeholder | Meaning | Your actual value |
|-------------|---------|-------------------|
| `{{SYSTEM_INFO}}` | Your operating system | WSL2 Ubuntu 24.04 / macOS Sonoma / Windows 11 / ... |
| `{{CODING_STYLE_NOTE}}` | Code commenting style | "Add function-level comments" / "Only comment complex logic" / ... |
| `{{EMOJI_USAGE_NOTE}}` | Emoji usage preference | "Use emojis in responses" / "Only in titles" / "Don't use" / ... |

> **Already have an AGENTS.md**? `install.sh` won't overwrite your personal config — it protects your existing global preferences.

Uninstall:

```bash
bash uninstall.sh   # Removes all above files + cleans plugin registration + CLI hints
```

---

## 📋 Prerequisites

This project depends on the following external components. Install them **before** `bash install.sh`:

### 1. opencode (Required)

```bash
# Official installation (pick one)
npm install -g @opencode-ai/opencode
# or
curl -fsSL https://opencode.ai/install.sh | bash
```

### 2. Superpowers Workflow Skill System (Strongly Recommended)

Superpowers provides 14 workflow orchestration skills (brainstorming → writing-plans → subagent-driven-dev → review → finish). Sisyphus's `<openspec_protocol>` routing depends on it for the default workflow.

```bash
# Method A: opencode plugin install (recommended)
opencode plugin install superpowers

# Method B: Manual clone
git clone https://github.com/obra/superpowers.git \
  ~/.config/opencode/superpowers
```

> Without Superpowers, Sisyphus will skip these skills and fall back to opencode built-in tools.

### 3. OpenSpec CLI (Optional — only for spec-driven changes)

OpenSpec is a project-level spec center. You need it when you want **multi-change parallel tracking**, **spec smart merge**, or **requirement change tracking**. Daily CRUD / research / simple implementations **don't need** it.

```bash
npm install -g @fission-ai/openspec@latest
```

**On-demand init** (run in projects that need spec-driven workflows, not globally):

```bash
cd your-project
openspec init --tools opencode
```

`openspec init` generates `.opencode/skills/openspec-*` (5 skills) and `.opencode/commands/opsx-*` (5 commands) in the project directory. **These are project-level auto-generated artifacts — we don't bundle them in our repo.** Users run them on-demand in their own projects.

### Check List

```bash
opencode --version              # Confirm opencode is installed
ls ~/.cache/opencode/packages/  # Confirm Superpowers is installed
openspec --version              # Confirm openspec CLI is available (optional)
```

### 4. RTK (Strongly Recommended — Saves 60-90% Tokens)

[RTK](https://github.com/rtk-ai/rtk) is a CLI proxy that automatically compresses the output of common commands like `git status`/`ls`/`grep`/`cat` before sending it to the LLM context. Single Rust binary, zero dependencies, <10ms overhead.

**Effect** (30-min session): ~118K tokens → ~24K tokens (**-80%**)

```bash
# Install RTK
brew install rtk
# Or: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh

# Initialize for opencode (installs hook + RTK.md guidance)
rtk init -g --opencode

# Verify
rtk --version   # rtk 0.x
rtk gain        # View token savings stats
```

After initialization, the agent's bash commands are automatically rewritten:
- `git status` → `rtk git status` (~200 tokens → ~40)
- `grep "pattern"` → `rtk grep "pattern"` (grouped output)
- `cargo test` → `rtk test cargo test` (failures only, ~2000 tokens → ~200)
- `ls -la` → `rtk ls` (directory tree, ~800 tokens → ~150)

> RTK is machine-level, **not affecting other users** — every agent benefits independently.

### ⚠️ About mattpocock/skills

Our `grill-with-docs`, `diagnose`, `to-issues` are **verbatim imports** from [mattpocock/skills](https://github.com/mattpocock/skills) — only the 3 we actually need, not the full 11. **Do not** also run mattpocock's official setup script, otherwise same-named skills will conflict, and opencode will dedupe based on file system traversal order, with unpredictable results.

| Method | Effect |
|--------|--------|
| ✅ Use our `install.sh` | Exactly 3 skills, no conflict |
| ❌ Also run mattpocock official setup | 3 same-name skills, unknown which wins |

---

## 📦 Required vs Recommended vs Optional

The minimum to run the project is just `opencode` itself. Everything else improves the experience but can be added incrementally.

### Tier 1: Required (Required for any functionality)

| Component | Why | Install |
|-----------|-----|---------|
| **opencode 1.16.2+** | Runtime | `npm i -g @opencode-ai/opencode` |

Without this, nothing works.

### Tier 2: Strongly Recommended (Core features disabled without these)

| Component | Why | Install |
|-----------|-----|---------|
| **Superpowers (14 skills)** | Provides the default workflow (`brainstorming → writing-plans → subagent-driven-dev → review → finish`) that Sisyphus uses as its backbone | `opencode plugin install superpowers` |
| **RTK (Rust Token Killer)** | Saves 60-90% tokens on common commands (`git status`/`ls`/`grep`/`cargo test`/...) | `brew install rtk && rtk init -g --opencode` |

Without these, Sisyphus still works but:
- No Superpowers → Sisyphus's `<openspec_protocol>` defaults fall back to built-in tools, less structured workflow
- No RTK → every command uses standard output, more tokens

### Tier 3: Optional (For specific advanced features)

| Component | Why | Install |
|-----------|-----|---------|
| **OpenSpec CLI** | Multi-change parallel tracking, spec smart merge, change DAG | `npm i -g @fission-ai/openspec@latest` |
| **MiniMax CLI (`mmx`)** | Multimodal (image/video/speech/music) + web search — works with any model | `npm i -g mmx-cli && mmx auth login` |
| **Context7 CLI (`ctx7`)** | Library documentation queries (replaces self-built `context7-docs` tool) | `npm i -g ctx7 && npx ctx7 setup --opencode` |
| **Playwright CLI (`playwright-cli`)** | Browser automation (replaces self-built `playwright-browser` tool) | `npm i -g @playwright/cli@latest && playwright-cli install --skills` |

### Skills Already Provided by This Project (6)

After `bash install.sh`, these skills are mirrored to `~/.config/opencode/skills/`:

| Skill | Type | Trigger |
|-------|------|---------|
| `karpathy-guidelines` | Self-built (4 karpathy principles) | Auto-injected on every LLM call by orchestrator |
| `openspec-integration` | Self-built (routing bridge) | Two-layer trigger: (1) keyword OR (2) semantic intent (multi-step change / cross-spec) |
| `grill-with-docs` | Imported from mattpocock/skills | Adversarial questioning of plans |
| `diagnose` | Imported from mattpocock/skills | Hard bugs, performance regressions |
| `to-issues` | Imported from mattpocock/skills | Break plan into independent issues |
| `mmx-cli-usage` | Self-built (mmx guide) | Multimodal / search needs |

### Quick Verification

```bash
# Tier 1: opencode
opencode --version

# Tier 2: superpowers + rtk
ls ~/.cache/opencode/packages/superpowers@* 2>/dev/null && echo "✅ superpowers" || echo "❌ superpowers missing"
rtk --version 2>/dev/null && echo "✅ rtk" || echo "❌ rtk missing"

# Tier 3: optional
openspec --version 2>/dev/null && echo "✅ openspec" || echo "❌ openspec missing"
command -v mmx && echo "✅ mmx" || echo "❌ mmx missing"
command -v ctx7 && echo "✅ ctx7" || echo "❌ ctx7 missing"
command -v playwright-cli && echo "✅ playwright-cli" || echo "❌ playwright-cli missing"
```

### OpenSpec Fallback Strategy (Graceful Degradation)

The `openspec-integration` skill has a built-in 4-tier fallback strategy:

| Scenario | Detection | Fallback |
|----------|-----------|----------|
| **A. CLI missing** | `command -v openspec` fails | Downgrade to Superpowers workflow + remind user to install |
| **B. CLI exists but project not initialized** | `openspec/` dir doesn't exist | Ask user, then auto-run `openspec init --tools opencode` |
| **C. Target change doesn't exist** | apply/archive can't find change | List existing changes, ask user to re-specify |
| **D. Change structure corrupted** | Missing proposal.md/tasks.md | Report + suggest `openspec validate <id>`, don't try to repair |

**Core principle**: **Never fabricate OpenSpec artifacts.** Downgrade explicitly, never silently.

---

After install, edit `~/.config/opencode/opencode.json` to add the 3-tier models:

```json
{
  "agent": {
    "sisyphus":   { "model": "<provider>/<high-tier-model-id>" },
    "lyra":       { "model": "<provider>/<mid-tier-model-id>" },
    "hephaestus": { "model": "<provider>/<low-tier-model-id>" }
  }
}
```

### Recommended Pairings

| Tier | Role | Recommended Models (Examples) | Monthly Estimate |
|------|------|------------------------------|-----------------|
| **high** | Sisyphus — architecture decisions, intent routing | `anthropic/claude-opus-4-20250514` or `deepseek/deepseek-v4-pro` | ~$200 |
| **mid** | Lyra — complex implementation, research | `anthropic/claude-sonnet-4-20250514` or `deepseek/deepseek-v4-flash` | ~$20 |
| **low** | Hephaestus — CRUD, mechanical refactor | `anthropic/claude-haiku-4-20250514` or `deepseek/deepseek-v4-flash-free` | ~$0 |

### Global Default Model (Lazy Option)

If you don't want to configure 3 agents, just set the global model:

```json
{
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

> ⚠️ In this case, the orchestrator plugin will inject a warning on every LLM call, noting that 3 tiers are not configured. It won't break anything, but full configuration is recommended for the best cost/performance ratio.

### Provider Configuration

Provider / API Key is configured via opencode's `/connect` command (in TUI), or directly in the `provider` section of `opencode.json`. This project **does not** manage provider configuration — it reuses your existing opencode environment.

### Prefer Sisyphus Over build

After install, opencode defaults to two primary agents: **build** and **plan**. With our project installed, a third **Sisyphus** (also primary) becomes available.

**On first opencode launch** (press **Tab** to cycle primary agents):

```
┌─ build (opencode native)         ← Full-featured but no 3-tier routing
├─ plan (opencode native)          ← Read-only planning
├─ Sisyphus (our project)          ← ★ Recommended entry
└─ (other built-in subagents)
```

| Agent | When to Use |
|-------|-------------|
| **Sisyphus** | 99% of tasks — architecture, delegation, cross-file, complex implementations |
| **build** | Just want to run a single shell command / quick read file, no need for Sisyphus's 3-tier routing |
| **plan** | Read-only analysis, zero modifications |

**Quick switch**: In TUI press **Tab** (or `switch_agent` keybind) to cycle Sisyphus and build.

**@ delegate to sub-agents**:
```
@lyra help me implement this feature
@hephaestus create 5 CRUD files
```

You can also let Sisyphus delegate directly in conversation (it auto-selects based on its intent_gate routing table).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Sisyphus (primary, high-tier)                           │
│  • Architecture + design decisions                       │
│  • Routes to Lyra or Hephaestus via 9-row intent table   │
│  • Owns OpenSpec, CLI routing, skill discovery           │
└─────┬───────────────────────────┬────────────────────────┘
      │                           │
      ▼                           ▼
┌─────────────────────┐    ┌───────────────────────────────┐
│ Lyra (mid-tier)     │    │ Hephaestus (low-tier)         │
│ • Complex code      │    │ • CRUD / atomic refactor      │
│ • Research          │    │ • Test boilerplate            │
│ • OpenSpec uses     │    │ • task: deny (leaf)           │
│ • Can delegate to ──┼───▶│   (can't spawn sub-agents)    │
│   Hephaestus        │    │ • bash safe-glob (no rm -rf /)│
└─────────────────────┘    └───────────────────────────────┘
```

**Strict depth=3 rule**: Hephaestus's `task: deny` is opencode's hard guarantee — the Task tool is **physically removed** from Hephaestus's available tools. No infinite recursion.

### Routing Logic

| Intent | Trigger | Route | Tier | OpenSpec |
|--------|---------|-------|------|----------|
| ARCHITECTURE | major architecture decisions | self | high | yes |
| DESIGN | new feature design (incl. single-file) | self | high | yes |
| COMPLEX_CODE | cross-file new feature (≥2 files) | **Lyra** | mid | yes |
| RESEARCH | investigation, docs | **Lyra** | mid | no |
| DEBUG_HARD | complex bug (diagnose + fix + verify) | **Lyra** | mid | no |
| DEBUG_SIMPLE | obvious bug (≤10 lines) | self | high | no |
| CRUD | 3+ similar files | **Hephaestus** | low | no |
| ATOMIC_REFACTOR | mechanical transform (e.g. rename) | **Hephaestus** | low | no |
| TEST_BOILERPLATE | test scaffolding | **Hephaestus** | low | no |

**Core principle**: **Reasoning complexity** (not file count) determines the tier.

---

## 🛡️ Permission Strategy (Reduce Prompting)

Following the official permissions documentation ([opencode permissions](https://opencode.ai/docs/zh-cn/permissions/)), we configured **fine-grained glob rules**. The principle: **project-internal defaults to allow, project-external ask, dangerous operations deny**.

### Three-Axis Strategy

| Dimension | Rule | Example |
|-----------|------|---------|
| **Scope** | Project-internal allow / project-external ask / `.env*` deny | `edit: { "*": allow, "**/../**": ask, "**/.env*": deny }` |
| **Command Type** | Dangerous deny / package mgmt allow / publish deny / other ask | `rm -rf /*` deny; `npm install` allow; `npm publish` deny |
| **Agent Gradient** | Differentiate by agent role | Hephaestus `bash: *: allow` (worker needs many commands); Sisyphus/Lyra `bash: *: ask` (conservative) |

### Detailed Matrix

| Operation | Sisyphus | Lyra | Hephaestus |
|-----------|----------|------|-----------|
| `read / grep / glob / webfetch / websearch` | ✅ allow | ✅ allow | ✅ allow (websearch deny) |
| `edit / write` project-internal | ✅ allow | ✅ allow | ✅ allow |
| `edit / write` project-external | ⚠️ ask | ⚠️ ask | ⚠️ ask |
| `edit / write` `.env*` | ❌ deny | ❌ deny | ❌ deny |
| `bash` package install (`npm install`/`bun add`/`cargo build`/...) | ✅ allow | ✅ allow | ✅ allow |
| `bash` package publish (`npm publish`/`cargo publish`/...) | ❌ deny | ❌ deny | ❌ deny |
| `bash` dangerous (`rm -rf /`, `sudo`, `mkfs`, `dd`, `chmod -R 777`) | ❌ deny | ❌ deny | ❌ deny |
| `bash` other (`git status`/`ls`/`cd`/...) | ⚠️ ask | ⚠️ ask | ✅ allow (worker-friendly) |
| `task` delegation | lyra/hephaestus | hephaestus | ❌ deny |
| `external_directory` | ⚠️ ask | ⚠️ ask | ⚠️ ask |

### Design Intent

- **Sisyphus / Lyra stay cautious**: bash unknown commands default to `ask` to avoid misoperation
- **Hephaestus runs many commands**: workers mainly do CRUD, `bash: *: allow` reduces prompting
- **Package management whitelist**: `npm/yarn/pnpm/bun install` all allow (high frequency in dev), `publish` all deny (prevent accidental release)
- **Dangerous command blacklist**: `rm -rf /` catastrophic delete, `sudo` privilege escalation, `mkfs` format, `dd` disk wipe — all hard deny
- **`.env` always forbidden**: 3 agents all have `read/edit/write: *.env*: deny` (default behavior, but explicitly declared)

### Pattern Matching Example

```yaml
# How these glob patterns work:
bash:
  "*": ask                           # Default: all unmatched commands ask
  "rm -rf /*": deny                  # Catastrophic delete deny
  "sudo *": deny                     # Privilege escalation deny
  "npm install *": allow             # Package install allow
  "npm publish *": deny              # Publish deny (more specific overrides wildcard)
  "git *": allow                     # Git read operations allow
  "git push --force *": deny         # Force push deny
```

**Last-rule-wins**: In each permission block, **the last matching rule takes priority**. So conventionally put `"*": ask` first, specific rules after.

### Customization

To change an agent's permissions, edit the corresponding `agents/<name>.md` frontmatter, then:

```bash
bash install.sh   # Re-mirror to ~/.config/opencode/
```

---

## 🧩 Skill System

### Bring-in Skills (Imported, Not Self-Built)

| Skill | Source | Trigger Condition | Applicable Agents |
|-------|--------|-------------------|-------------------|
| **karpathy-guidelines** | multica-ai/andrej-karpathy-skills | All LLM calls (orchestrator auto-injects) | All |
| **grill-with-docs** | mattpocock/skills | Stress-test plan vs domain model consistency | Sisyphus / Lyra |
| **diagnose** | mattpocock/skills | Hard bugs, performance regressions (6-phase loop) | Lyra (primary use) |
| **to-issues** | mattpocock/skills | Break down plan/spec into independent issues | Sisyphus |

### OpenSpec Integration (Project-Level Spec-Driven)

| Command | Function | Who Uses |
|---------|----------|----------|
| `/opsx:propose` | Create change proposal | Sisyphus / Lyra |
| `/opsx:explore` | Free exploration | Sisyphus / Lyra |
| `/opsx:apply` | Implement tasks.md | Lyra (delegated execution) |
| `/opsx:sync` | Merge delta → main spec | Sisyphus |
| `/opsx:archive` | Archive completed change | Sisyphus |

**Hephaestus bypasses OpenSpec entirely** — CRUD doesn't need specs.

### OpenSpec Two-Layer Trigger

The `openspec-integration` skill uses a **two-layer trigger** to balance accuracy vs user-friendliness:

| Layer | Type | Trigger | Behavior |
|-------|------|---------|----------|
| **Layer 1** | Strong (keyword) | User says `propose/explore/apply/sync/archive/提议/应用/归档` | **Always** OpenSpec (no questions) |
| **Layer 2** | Semantic (suggest) | Task involves multi-step change / cross-spec impact / requirement tracking / brownfield | **SUGGEST** OpenSpec + ask user |
| **Layer 3** | Default | None of the above | Superpowers (no OpenSpec) |

**Semantic signals that suggest OpenSpec**:
- Multi-step change with cross-spec impact (e.g., "重构 auth + 改 user model + 改 API")
- Cross-spec influence query (e.g., "改 X 会影响 Y 吗？")
- Requirement change tracking (e.g., "这个 spec 改了哪些 task？")
- Brownfield legacy code modifications
- Audit / review (e.g., "上个月做的 X 在哪？")
- Multiple parallel changes
- New project initialization

**SUGGEST template** (Sisyphus says this when Layer 2 matches):
> "This task looks like [multi-step change / cross-spec / ...] — OpenSpec handles this well.
> Go OpenSpec (write proposal.md first) or Superpowers (brainstorming → plans)?
> - OpenSpec: I'll create `openspec/changes/X/` with proposal.md
> - Superpowers: I'll go straight to brainstorming + writing-plans"

**Anti-patterns** (don't do these):
- ❌ "新功能" → auto OpenSpec (too aggressive, false positives)
- ❌ "改" → ask "要不要 OpenSpec" (too noisy, breaks flow)
- ✅ keyword → unconditionally OpenSpec
- ✅ semantic → SUGGEST once with reason
- ✅ default → silently Superpowers

### Foundation: Superpowers (14 skills, used in full)

The **full workflow foundation** of this project. Superpowers provides end-to-end process orchestration from idea to merge (brainstorming → writing-plans → subagent-driven-dev → review → finish). Sisyphus's `<openspec_protocol>` segment handles routing: OpenSpec keyword mentioned → go OpenSpec; default → go Superpowers.

> Requires separate install: `opencode plugin install superpowers` (see [Prerequisites](#3-openspec-clioptional--only-for-spec-driven-changes)). This project **does not** ship Superpowers skill files.

---

## 📦 Components

| Component | Type | Count | Source |
|-----------|------|-------|--------|
| Agents | `.md` prompt files | **3** | Self-built |
| Skills | `SKILL.md` files | **6** | 2 self-built + 4 imported |
| Tools | TypeScript → `.js` | **2** | Self-built (hashline-edit + task-dispatch) |
| Plugin | `orchestrator.js` | **1** | Self-built |
| CLIs | npm -g | **3** | mmx-cli (MiniMax multimodal+search) + ctx7 (lib docs) + playwright-cli (browser automation) |

---

## 🛠️ Customization Notes

### Modify Agent Behavior

Edit `agents/<agent>.md`, then re-run install:

```bash
vim agents/sisyphus.md   # Edit routing rules, delegation protocol, style_guide
bash install.sh           # Mirror to ~/.config/opencode/
```

### Add a New Skill

```bash
mkdir -p skills/my-skill
cp /path/to/SKILL.md skills/my-skill/
# Add to install.sh's SKILLS array
bash install.sh
```

### Modify Tools

```bash
cd tools
vim src/task-dispatch.ts   # Edit routing/CLI proxy logic
bun test                   # Verify tests
bun run build              # Build
bash ../install.sh         # Deploy
```

### Skip a Component

`install.sh` only installs files that **exist**. To skip:
- Agent: Delete `agents/<name>.md` then run install
- Skill: Remove from `SKILLS` array
- Tool: Delete `tools/dist/<tool>.js`

### Project-Level Customization (Recommended Pattern)

Our project is **global layer config** — once installed to `~/.config/opencode/`, it's available for all projects. To add project-level rules to a specific project, follow the official layering:

#### 1. Project-Level `AGENTS.md` (Project-Specific Rules)

Create `AGENTS.md` at the project root, **merged with global AGENTS.md** (project-level takes precedence):

```bash
cd your-project
cat > AGENTS.md <<'EOF'
# My Project Rules

## Build Commands
- `bun install` install dependencies
- `bun test` run tests
- `bun run build` build

## Architecture Conventions
- src/components/ - React components
- src/api/ - Backend API routes
- tests/ - Unit tests

## Skill Routing (Project-Level)
This project uses Sisyphus (not build). Default workflow:
- Start a requirement → Superpowers `brainstorming`
- Write code → `lyra` subagent (mid-tier)
- Repetitive tasks → `hephaestus` subagent (low-tier)
- Complex changes → OpenSpec `/opsx:propose`
- Hard bugs → Superpowers `systematic-debugging` or `diagnose` skill
EOF
```

**Loading rules**: opencode walks up from cwd to git worktree, the first matching `AGENTS.md` takes precedence; falls back to `~/.config/opencode/AGENTS.md` if not found.

**Global vs Project Division of Labor**:
- Global AGENTS.md: **Personal behavior preferences** (language/system/comment style/Emoji)
- Project-level AGENTS.md: **Project architecture/build commands/project-level skill routing**

#### 2. Project-Level `opencode.json` (Merge, Not Replace)

Create `opencode.json` at the project root, **merged with global `~/.config/opencode/opencode.json`**:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "sisyphus": { "model": "anthropic/claude-opus-4-20250514" }
  }
}
```

**Merge rules**: Project-level **only overrides conflicting keys**; global's provider/MCP/plugin are all preserved. So after installing our project, **you don't need to configure providers again** — just reuse the global ones.

#### 3. Project-Level Skill Loading

opencode by default scans 6 paths:

| Location | Priority |
|----------|----------|
| `.opencode/skills/<name>/SKILL.md` | Project-level (overlays global) |
| `.claude/skills/<name>/SKILL.md` | Project-level (Claude compatible) |
| `.agents/skills/<name>/SKILL.md` | Project-level (agent compatible) |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global |
| `~/.claude/skills/<name>/SKILL.md` | Global (Claude compatible) |
| `~/.agents/skills/<name>/SKILL.md` | Global (agent compatible) |

**Same-name skills from all paths are loaded**. If a project wants to override a global same-name skill, **use the `permission` field to control visibility**:

```json
// .opencode/opencode.json
{
  "permission": {
    "skill": {
      "karpathy-guidelines": "deny"  // Hide global one in this project
    }
  }
}
```

#### 4. Project-Level Agent Override

If a project wants to override the behavior of one of our 3 agents, place a same-name `.md` in `.opencode/agents/`:

```bash
mkdir -p .opencode/agents
cp ~/.config/opencode/agents/sisyphus.md .opencode/agents/sisyphus.md
# Edit project-level sisyphus.md (modify intent_gate routing, etc.)
```

**Loading rules**: Project-level same-name agent overrides global. Our `install.sh` only installs to `~/.config/opencode/agents/` — **doesn't pollute project directories**.

---

## 🔍 Verification

```bash
# Tests (65 pass, 0 fail)
cd tools && bun test

# Typecheck (0 errors)
cd tools && bun run typecheck

# Build
cd tools && bun run build

# Install (idempotent)
bash install.sh

# Confirm CLI availability
for cmd in mmx ctx7 playwright-cli; do
  command -v $cmd && echo "  ✅ $cmd" || echo "  ⬜ $cmd"
done
```

---

## 📁 Repository Structure

```
myOpenCodeWithMEeee/
├── agents/                 # 3 agent prompt files
│   ├── sisyphus.md         # primary (high-tier) — 7 XML segments + 9-row routing
│   ├── lyra.md             # subagent (mid-tier) — can delegate to Hephaestus
│   └── hephaestus.md       # subagent (low-tier) — task:deny, bash safe-glob
├── skills/                 # 6 skills (SKILL.md)
│   ├── karpathy-guidelines/
│   ├── openspec-integration/
│   ├── grill-with-docs/
│   ├── diagnose/
│   ├── to-issues/
│   └── mmx-cli-usage/
├── tools/                  # 2 self-built tools
│   ├── src/                # TypeScript source + tests
│   └── dist/               # Build artifacts (gitignored)
├── .opencode/
│   ├── src/orchestrator.ts # Plugin source (karpathy injection + 3-tier check)
│   └── plugins/            # Build artifacts
├── docs/                   # Design documents
│   ├── 2026-06-10-1plus1plus1-agent-system-design.md
│   └── 2026-06-10-v2-migration-plan.md
├── templates/              # Config templates
│   └── AGENTS.md           # Global AGENTS.md template (copied on first install, never overwrites)
├── install.sh              # One-click install (idempotent)
├── uninstall.sh            # One-click uninstall
├── CHANGELOG.md            # Changelog
├── CONTRIBUTING.md         # Contribution guide
├── README.md               # Chinese version
├── README.en.md            # English version
└── LICENSE                 # MIT
```

---

## 📄 License

This project is licensed under MIT, see [LICENSE](./LICENSE).