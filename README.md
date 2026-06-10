# myOpenCodeWithMEeee

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Custom **1 + 1 + 1 agent system** for opencode, with **3-tier model routing** (high / mid / low). Drawing design from [Pi Subagents](https://github.com/mattpocock/skills) (frontmatter nesting + bash safety) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), with [karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills) and [OpenSpec](https://github.com/Fission-AI/OpenSpec) integrations.

---

## ⚡ 一键安装

```bash
git clone https://github.com/meisijiya/myOpenCodeWithMEeee.git
cd myOpenCodeWithMEeee
bash install.sh
```

**安装脚本会自动完成**：

| 自动化项 | 详情 |
|---------|------|
| **3 agents** | `sisyphus.md` / `lyra.md` / `hephaestus.md` → `~/.config/opencode/agents/` |
| **6 skills** | karpathy-guidelines / openspec-integration / grill-with-docs / diagnose / to-issues / mmx-cli-usage |
| **2 tools** | `hashline-edit.js` / `task-dispatch.js` → `~/.config/opencode/tools/` |
| **1 plugin** | `orchestrator.js` 自动注册到 `opencode.json` 的 `plugin` 数组 |
| **3 CLIs** | `mmx` / `ctx7` / `playwright-cli` — 通过 bash 调用，token 高效（不塞整页 DOM 进上下文） |

> 所有操作**幂等**——重复运行不会重复注册。

卸载：

```bash
bash uninstall.sh   # 移除所有上述文件 + 清理插件注册 + CLI 提示
```

---

## 📋 前置依赖

本项目依赖以下外部组件，需在 `bash install.sh` **之前**安装：

### 1. opencode（必须）

```bash
# 官方安装方式（任选一种）
npm install -g @opencode-ai/opencode
# 或
curl -fsSL https://opencode.ai/install.sh | bash
```

### 2. Superpowers 流程编排 skill 体系（强烈推荐）

Superpowers 提供 14 个流程编排 skill（brainstorming → writing-plans → subagent-driven-dev → review → finish），Sisyphus 的 `<openspec_protocol>` 路由依赖它做默认工作流。

```bash
# 方式 A：opencode 插件安装（推荐）
opencode plugin install superpowers

# 方式 B：手动 clone
git clone https://github.com/obra/superpowers.git \
  ~/.config/opencode/superpowers
```

> 如果不装 Superpowers，Sisyphus 会跳过这些 skill，用 opencode 内置工具退化工作。

### 3. OpenSpec CLI（可选——需要规约驱动变更时）

OpenSpec 是项目级规约中心。当你需要**多 change 并行跟踪**、**spec 智能合并**、或**需求变更追踪**时才需要。日常 CRUD / 调研 / 简单实现**不需要**。

```bash
npm install -g @fission-ai/openspec@latest
```

**按需初始化**（在需要规约驱动的项目里跑，不是全局）：

```bash
cd your-project
openspec init --tools opencode
```

`openspec init` 会在项目目录下生成 `.opencode/skills/openspec-*`（5 个 skill）和 `.opencode/commands/opsx-*`（5 个 command）。**这些是项目级自动生成物，我们不绑进仓库**——用户按需在自己的项目里跑。

### 检查清单

```bash
opencode --version              # 确认 opencode 已安装
ls ~/.cache/opencode/packages/  # 确认 Superpowers 已安装
openspec --version              # 确认 openspec CLI 可用（可选）
```

### 4. RTK（强烈推荐——省 60-90% Token）

[RTK](https://github.com/rtk-ai/rtk) 是一个 CLI 代理，会自动把 `git status`/`ls`/`grep`/`cat` 等常见命令的输出压缩后再送入 LLM 上下文。单个 Rust 二进制，零依赖，<10ms 开销。

**效果**（30 分钟 session）：~118K tokens → ~24K tokens（**-80%**）

```bash
# 安装 RTK
brew install rtk
# 或者: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh

# 为 opencode 初始化（安装 hook + RTK.md 指导）
rtk init -g --opencode

# 验证
rtk --version   # rtk 0.x
rtk gain        # 查看 token 节省统计
```

初始化后，Agent 的 bash 命令会被自动重写：
- `git status` → `rtk git status`（~200 tokens 变 ~40）
- `grep "pattern"` → `rtk grep "pattern"`（分组输出）
- `cargo test` → `rtk test cargo test`（仅显示失败，~2000 tokens 变 ~200）
- `ls -la` → `rtk ls`（目录树，~800 tokens 变 ~150）

> RTK 是本机级的，**不影响其他用户**——每个人的 Agent 独立受益。

### ⚠️ 关于 mattpocock/skills

我们的 `grill-with-docs`、`diagnose`、`to-issues` 是从 [mattpocock/skills](https://github.com/mattpocock/skills) **原样导入**的（verbatim import）——只取了项目实际需要的 3 个，不是全量 11 个。**不要**另外跑 mattpocock 的官方 setup 脚本，否则同名 skill 会冲突，opencode 按文件系统遍历顺序去重，结果不可预测。

| 方式 | 效果 |
|------|------|
| ✅ 用我们的 `install.sh` | 恰好 3 个，无冲突 |
| ❌ 额外跑 mattpocock 官方 setup | 3 个重名 skill，不确定哪个生效 |

---

## ⚙️ 模型配置（必须手工配）

安装完后，编辑 `~/.config/opencode/opencode.json`，添加 3 档模型：

```json
{
  "agent": {
    "sisyphus":   { "model": "<provider>/<high-tier-model-id>" },
    "lyra":       { "model": "<provider>/<mid-tier-model-id>" },
    "hephaestus": { "model": "<provider>/<low-tier-model-id>" }
  }
}
```

### 推荐搭配

| 档位 | 角色 | 推荐模型（示例） | 月费估算 |
|------|------|-----------------|---------|
| **high** | Sisyphus — 架构决策、意图路由 | `anthropic/claude-opus-4-20250514` 或 `deepseek/deepseek-v4-pro` | ~$200 |
| **mid** | Lyra — 复杂实现、调研 | `anthropic/claude-sonnet-4-20250514` 或 `deepseek/deepseek-v4-flash` | ~$20 |
| **low** | Hephaestus — CRUD、机械重构 | `anthropic/claude-haiku-4-20250514` 或 `deepseek/deepseek-v4-flash-free` | ~$0 |

### 全局默认模型（省事方案）

如果不想配 3 个 agent，可以只设全局 model：

```json
{
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

> ⚠️ 这种情况下，orchestrator 插件会在每次 LLM 调用时注入一条 warning，提示 3 档位未配置。不影响使用，但推荐完整配置以获得最佳性价比。

### Provider 配置

Provider / API Key 通过 opencode 的 `/connect` 命令配置（TUI 内），或者直接在 `opencode.json` 的 `provider` 段配置。本项目**不**管理 provider 配置——复用你已有的 opencode 环境。

---

## 🏗️ 架构

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
│ • OpenSpec uses     │    │ • task: deny (叶子)            │
│ • Can delegate to ──┼───▶│   (can't spawn sub-agents)    │
│   Hephaestus        │    │ • bash safe-glob (no rm -rf /)│
└─────────────────────┘    └───────────────────────────────┘
```

**Strict depth=3 rule**: Hephaestus's `task: deny` is opencode's hard guarantee — the Task tool is **physically removed** from Hephaestus's available tools. No infinite recursion.

### 路由逻辑

| Intent | Trigger | Route | Tier | OpenSpec |
|-------|---------|-------|------|----------|
| ARCHITECTURE | major architecture decisions | self | high | yes |
| DESIGN | new feature design (incl. single-file) | self | high | yes |
| COMPLEX_CODE | cross-file new feature (≥2 files) | **Lyra** | mid | yes |
| RESEARCH | investigation, docs | **Lyra** | mid | no |
| DEBUG_HARD | complex bug (diagnose + fix + verify) | **Lyra** | mid | no |
| DEBUG_SIMPLE | obvious bug (≤10 lines) | self | high | no |
| CRUD | 3+ similar files | **Hephaestus** | low | no |
| ATOMIC_REFACTOR | mechanical transform (e.g. rename) | **Hephaestus** | low | no |
| TEST_BOILERPLATE | test scaffolding | **Hephaestus** | low | no |

**核心判断**：**推理复杂度**（不是文件数）决定档位。

---

## 🧩 技能体系

### Bring-in Skills（外部导入，不做自研）

| Skill | 来源 | 触发条件 | 适用 Agent |
|-------|------|---------|-----------|
| **karpathy-guidelines** | multica-ai/andrej-karpathy-skills | 所有 LLM 调用（orchestrator 自动注入） | 全部 |
| **grill-with-docs** | mattpocock/skills | 压测计划与领域模型一致性 | Sisyphus / Lyra |
| **diagnose** | mattpocock/skills | 硬 bug、性能回归（6 阶段循环） | Lyra（主场景） |
| **to-issues** | mattpocock/skills | 把 plan/spec 拆成独立 issues | Sisyphus |

### OpenSpec 集成（项目级规约驱动）

| Command | 功能 | 谁用 |
|---------|------|------|
| `/opsx:propose` | 创建 change 提案 | Sisyphus / Lyra |
| `/opsx:explore` | 自由探索 | Sisyphus / Lyra |
| `/opsx:apply` | 实施 tasks.md | Lyra（委派执行） |
| `/opsx:sync` | 合并 delta → 主 spec | Sisyphus |
| `/opsx:archive` | 归档完成的 change | Sisyphus |

**Hephaestus 全部绕过 OpenSpec**——CRUD 不需要规约。

### Superpowers 工作流（14 skills，预装在 opencode 环境）

本项目**不**自带 Superpowers skill 文件——它们随 opencode 的 superpowers 插件提供。Sisyphus 的 `<openspec_protocol>` 段负责路由：提到 OpenSpec 关键词 → 走 OpenSpec；默认 → 走 Superpowers。

---

## 📦 组件清单

| 组件 | 类型 | 数量 | 来源 |
|------|------|------|------|
| Agents | `.md` prompt 文件 | **3** | 自研 |
| Skills | `SKILL.md` 文件 | **6** | 2 自研 + 4 外部导入 |
| Tools | TypeScript → `.js` | **2** | 自研（hashline-edit + task-dispatch） |
| Plugin | `orchestrator.js` | **1** | 自研 |
| CLIs | npm -g | **3** | mmx-cli (MiniMax 多模态+搜索) + ctx7 (库文档) + playwright-cli (浏览器自动化) |

---

## 🛠️ 自定义须知

### 修改 Agent 行为

编辑 `agents/<agent>.md`，然后重跑安装：

```bash
vim agents/sisyphus.md   # 改路由规则、委派协议、style_guide
bash install.sh           # 镜像到 ~/.config/opencode/
```

### 添加新 Skill

```bash
mkdir -p skills/my-skill
cp /path/to/SKILL.md skills/my-skill/
# 加到 install.sh 的 SKILLS 数组
bash install.sh
```

### 修改工具

```bash
cd tools
vim src/task-dispatch.ts   # 改路由/CLI代理逻辑
bun test                   # 验证测试
bun run build              # 构建
bash ../install.sh         # 部署
```

### 跳过某个组件

install.sh 只安装**存在**的文件。要跳过：
- Agent：删掉 `agents/<name>.md` 后跑 install
- Skill：从 `SKILLS` 数组移除对应条目
- Tool：删掉 `tools/dist/<tool>.js`

---

## 🔍 验证

```bash
# 测试 (65 pass, 0 fail)
cd tools && bun test

# Typecheck (0 errors)
cd tools && bun run typecheck

# 构建
cd tools && bun run build

# 安装（幂等）
bash install.sh

# 确认 CLI 可用
for cmd in mmx ctx7 playwright-cli; do
  command -v $cmd && echo "  ✅ $cmd" || echo "  ⬜ $cmd"
done
```

---

## 📁 仓库结构

```
myOpenCodeWithMEeee/
├── agents/                 # 3 agent prompt 文件
│   ├── sisyphus.md         # primary (high-tier) — 7 XML segments + 9-row routing
│   ├── lyra.md             # subagent (mid-tier) — can delegate to Hephaestus
│   └── hephaestus.md       # subagent (low-tier) — task:deny, bash safe-glob
├── skills/                 # 6 个 skill（SKILL.md）
│   ├── karpathy-guidelines/
│   ├── openspec-integration/
│   ├── grill-with-docs/
│   ├── diagnose/
│   ├── to-issues/
│   └── mmx-cli-usage/
├── tools/                  # 2 个自研工具
│   ├── src/                # TypeScript 源码 + 测试
│   └── dist/               # 构建产物（gitignored）
├── .opencode/
│   ├── src/orchestrator.ts # 插件源码（karpathy 注入 + 3 档位检查）
│   └── plugins/            # 构建产物
├── docs/                   # 设计文档
│   ├── 2026-06-10-1plus1plus1-agent-system-design.md
│   └── 2026-06-10-v2-migration-plan.md
├── install.sh              # 一键安装（幂等）
├── uninstall.sh            # 一键卸载
├── CHANGELOG.md            # 变更日志
├── CONTRIBUTING.md         # 贡献指南
└── LICENSE                 # MIT
```

---

## 📄 License

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE)。