# myOpenCodeWithMEeee

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![English](https://img.shields.io/badge/EN-English-blue)](./README.md)
[![中文](https://img.shields.io/badge/中文-Chinese-red)](./README.zh-CN.md)

> 基于 **[Superpowers](https://github.com/obra/superpowers)**（14 个流程编排 skill）的轻量 opencode Agent 系统——**1 + 1 + 1 架构** + **3 档模型路由**（high / mid / low）+ **CLI-first 外部能力**。融合 [Pi Subagents](https://github.com/mattpocock/skills)（前端嵌套 + bash 安全）、[Matt Pocock 诊断三件套](https://github.com/mattpocock/skills)、[karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills)（编码纪律）、[OpenSpec](https://github.com/Fission-AI/OpenSpec)（规约驱动）、[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)（架构灵感）、[RTK](https://github.com/rtk-ai/rtk)（token 压缩）。

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
| **AGENTS.md 模板** | 仅在你**没有**全局 `~/.config/opencode/AGENTS.md` 时拷贝模板（**不覆盖**已有个人配置） |
| **3 CLIs** | `mmx` / `ctx7` / `playwright-cli` — 通过 bash 调用，token 高效（不塞整页 DOM 进上下文） |

> 所有操作**幂等**——重复运行不会重复注册。

### ⚠️ AGENTS.md 模板首次安装后必改

install.sh 会在 `~/.config/opencode/AGENTS.md` **不存在**时拷贝 `templates/AGENTS.md` 模板。**模板里有 3 个占位符**（每个用户的系统不一样）需要你手动改：

```bash
nano ~/.config/opencode/AGENTS.md
```

| 占位符 | 含义 | 你的实际值 |
|--------|------|----------|
| `{{SYSTEM_INFO}}` | 你的操作系统 | WSL2 Ubuntu 24.04 / macOS Sonoma / Windows 11 / ... |
| `{{CODING_STYLE_NOTE}}` | 代码注释风格 | "添加函数级注释" / "只在复杂逻辑处注释" / ... |
| `{{EMOJI_USAGE_NOTE}}` | Emoji 使用偏好 | "配合使用 Emoji" / "只在标题用" / "不用" / ... |

> **已有 AGENTS.md**？install.sh 不会覆盖你的个人配置——保护你已有的全局偏好设置。

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

## 📦 必装 / 推荐 / 可选

最简运行只需 `opencode` 本身。其他都能逐步增量添加。

### Tier 1: 必装（没它完全跑不起来）

| 组件 | 原因 | 安装 |
|------|------|------|
| **opencode 1.16.2+** | 运行时 | `npm i -g @opencode-ai/opencode` |

### Tier 2: 强烈推荐（缺这些核心功能受限）

| 组件 | 原因 | 安装 |
|------|------|------|
| **Superpowers (14 skills)** | 提供 Sisyphus 主用的默认工作流（brainstorming → writing-plans → subagent-driven-dev → review → finish） | `opencode plugin install superpowers` |
| **RTK (Rust Token Killer)** | 常用命令省 60-90% token（`git status`/`ls`/`grep`/`cargo test`/...） | `brew install rtk && rtk init -g --opencode` |

缺这些时 Sisyphus 仍能用，但：
- 没 Superpowers → Sisyphus `<openspec_protocol>` 默认回退到 opencode 内置工具，工作流没那么结构化
- 没 RTK → 所有命令用标准输出，token 消耗多

### Tier 3: 可选（针对特定高级功能）

| 组件 | 原因 | 安装 |
|------|------|------|
| **OpenSpec CLI** | 多 change 并行追踪、spec 智能合并、change DAG | `npm i -g @fission-ai/openspec@latest` |
| **MiniMax CLI (`mmx`)** | 多模态（图像/视频/语音/音乐）+ 网络搜索——任何模型都能调 | `npm i -g mmx-cli && mmx auth login` |
| **Context7 CLI (`ctx7`)** | 库文档查询（替代自建 context7-docs 工具） | `npm i -g ctx7 && npx ctx7 setup --opencode` |
| **Playwright CLI (`playwright-cli`)** | 浏览器自动化（替代自建 playwright-browser 工具） | `npm i -g @playwright/cli@latest && playwright-cli install --skills` |

### 本项目自带的 6 个 Skill（`bash install.sh` 自动装）

| Skill | 类型 | 触发 |
|-------|------|------|
| `karpathy-guidelines` | 自研（4 大 karpathy 原则） | orchestrator 自动注入每次 LLM 调用 |
| `openspec-integration` | 自研（OpenSpec ↔ Superpowers 路由桥） | 双层触发：关键词 OR 语义意图（多步/跨 spec） |
| `grill-with-docs` | 从 mattpocock/skills 导入 | 对抗性质询计划 |
| `diagnose` | 从 mattpocock/skills 导入 | 硬 bug、性能回归 |
| `to-issues` | 从 mattpocock/skills 导入 | 把 plan 拆成独立 issues |
| `mmx-cli-usage` | 自研（mmx CLI 使用指南） | 需要多模态/搜索时 |

### 一键验证

```bash
# Tier 1: opencode
opencode --version

# Tier 2: superpowers + rtk
ls ~/.cache/opencode/packages/superpowers@* 2>/dev/null && echo "✅ superpowers" || echo "❌ superpowers 缺"
rtk --version 2>/dev/null && echo "✅ rtk" || echo "❌ rtk 缺"

# Tier 3: 可选
openspec --version 2>/dev/null && echo "✅ openspec" || echo "❌ openspec 缺"
command -v mmx && echo "✅ mmx" || echo "❌ mmx 缺"
command -v ctx7 && echo "✅ ctx7" || echo "❌ ctx7 缺"
command -v playwright-cli && echo "✅ playwright-cli" || echo "❌ playwright-cli 缺"
```

### OpenSpec 兜底策略（优雅降级）

`openspec-integration` skill 内置 **4 级兜底矩阵**：

| 场景 | 检测 | 降级行为 |
|------|------|---------|
| **A. CLI 缺失** | `command -v openspec` 失败 | 降级到 Superpowers 工作流 + 提示用户安装 |
| **B. CLI 有但项目未 init** | `openspec/` 目录不存在 | 询问用户后自动跑 `openspec init --tools opencode` |
| **C. 目标 change 缺失** | apply/archive 找不到 change | 列出存在的 change，让用户重选 |
| **D. change 结构损坏** | proposal.md/tasks.md 缺失 | 报告 + 建议 `openspec validate <id>`，**不尝试修复** |

**核心原则**：**永不伪造 OpenSpec artifacts**。降级要明确告知用户，不能 silent 走另一条路。

---

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

### 推荐使用 Sisyphus 而非 build

安装后，opencode 默认提供两个 primary agent：**build** 和 **plan**。装了我们项目后，多了第三个 **Sisyphus**（也是 primary）。

**首次启动 opencode 时**（按 **Tab** 循环切换 primary agent）：

```
┌─ build (opencode 原生)         ← 全功能但无 3 档路由
├─ plan (opencode 原生)          ← 只读规划
├─ Sisyphus (我们项目)           ← ★ 推荐入口
└─ (其他 built-in subagents)
```

| Agent | 何时用 |
|-------|--------|
| **Sisyphus** | 99% 任务——架构、委派、跨文件、复杂实现 |
| **build** | 只想跑单个 shell 命令/快速 read 文件，不需要 Sisyphus 的 3 档路由 |
| **plan** | 只做只读分析，零修改 |

**快捷切换**：在 TUI 里按 **Tab**（或 `switch_agent` keybind）循环 Sisyphus 和 build。

**@ 委派子 agent**：
```
@lyra 帮我实现这个 feature
@hephaestus 创建 5 个 CRUD 文件
```

也可以在对话里直接让 Sisyphus 委派（按它的 intent_gate 路由表自动选择）。

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

## 🛡️ 权限策略（减少询问）

按官方权限文档（[opencode permissions](https://opencode.ai/docs/zh-cn/permissions/)）配置了**细粒度 glob 规则**，原则：**项目内默认 allow，项目外 ask，危险操作 deny**。

### 三轴策略

| 维度 | 规则 | 例子 |
|------|------|------|
| **范围** | 项目内 allow / 项目外 ask / `.env*` deny | `edit: { "*": allow, "**/../**": ask, "**/.env*": deny }` |
| **命令类型** | 危险 deny / 包管理 allow / 发布 deny / 其他 ask | `rm -rf /*` deny；`npm install` allow；`npm publish` deny |
| **Agent 梯度** | 按 agent 角色差异化 | Hephaestus `bash: *: allow`（worker 需要大量命令）；Sisyphus/Lyra `bash: *: ask`（保守） |

### 详细矩阵

| 操作 | Sisyphus | Lyra | Hephaestus |
|------|----------|------|-----------|
| `read / grep / glob / webfetch / websearch` | ✅ allow | ✅ allow | ✅ allow（除 websearch deny） |
| `edit / write` 项目内 | ✅ allow | ✅ allow | ✅ allow |
| `edit / write` 项目外 | ⚠️ ask | ⚠️ ask | ⚠️ ask |
| `edit / write` `.env*` | ❌ deny | ❌ deny | ❌ deny |
| `bash` 包安装（`npm install`/`bun add`/`cargo build`/...）| ✅ allow | ✅ allow | ✅ allow |
| `bash` 包发布（`npm publish`/`cargo publish`/...）| ❌ deny | ❌ deny | ❌ deny |
| `bash` 危险（`rm -rf /`、`sudo`、`mkfs`、`dd`、`chmod -R 777`）| ❌ deny | ❌ deny | ❌ deny |
| `bash` 其他（`git status`/`ls`/`cd`/...）| ⚠️ ask | ⚠️ ask | ✅ allow（worker 友好）|
| `task` 委派 | lyra/hephaestus | hephaestus | ❌ deny |
| `external_directory` | ⚠️ ask | ⚠️ ask | ⚠️ ask |

### 设计意图

- **Sisyphus / Lyra 保持谨慎**：bash 未知命令默认 `ask`，避免误操作
- **Hephaestus 大量命令**：worker 主要做 CRUD，`bash: *: allow` 减少询问
- **包管理白名单**：`npm/yarn/pnpm/bun install` 全部 allow（开发高频），`publish` 全 deny（防误发）
- **危险命令黑名单**：`rm -rf /` 灾难性删除、`sudo` 提权、`mkfs` 格式化、`dd` 磁盘擦写 全部硬 deny
- **`.env` 永远禁止**：3 个 agent 都 `read/edit/write: *.env*: deny`（默认就是，但显式声明）

### 模式匹配示例

```yaml
# 这些 glob 模式的工作方式：
bash:
  "*": ask                           # 默认：所有未匹配的命令 ask
  "rm -rf /*": deny                  # 灾难性删除 deny
  "sudo *": deny                     # 提权 deny
  "npm install *": allow             # 包安装 allow
  "npm publish *": deny              # 发布 deny（更具体的规则覆盖通配）
  "git *": allow                     # git 读操作 allow
  "git push --force *": deny         # 强制推送 deny
```

**Last-rule-wins**：每个 permission 块中**最后匹配的规则优先**。所以通常把 `"*": ask` 放最前，具体规则放后面。

### 自定义

如果想改某个 agent 的权限，编辑对应的 `agents/<name>.md` frontmatter，然后：

```bash
bash install.sh   # 重新镜像到 ~/.config/opencode/
```

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

### OpenSpec 双层触发

`openspec-integration` skill 用**双层触发**平衡准确性和易用性：

| 层 | 类型 | 触发 | 行为 |
|----|------|------|------|
| **Layer 1** | 强（关键词） | 用户说 `propose/explore/apply/sync/archive/提议/应用/归档` | **强制**走 OpenSpec（不问） |
| **Layer 2** | 弱（语义建议） | 任务涉及多步变更/跨 spec/需求追踪/brownfield 改造 | **SUGGEST** OpenSpec + 询问用户 |
| **Layer 3** | 默认 | 都没匹配 | Superpowers（不引入 OpenSpec） |

**语义建议的信号**（匹配任一则 SUGGEST）：
- 多步变更涉及跨 spec 影响（例："重构 auth + 改 user model + 改 API"）
- 跨 spec 影响查询（例："改 X 会影响 Y 吗？"）
- 需求变更追踪（例："这个 spec 改了哪些 task？"）
- brownfield 老项目改造
- 审计/复盘（例："上个月做的 X 在哪？"）
- 多个并行 change
- 新项目初始化

**SUGGEST 模板**（Sisyphus 在 Layer 2 匹配时说）：
> "这个任务看起来涉及[多步变更/跨 spec/...]——OpenSpec 比较擅长这个。
> 走 OpenSpec（先写 proposal.md）还是 Superpowers（直接 brainstorming）？
> - 走 OpenSpec: 我会创建 `openspec/changes/X/` 并写 proposal.md
> - 走 Superpowers: 我会直接 brainstorming + writing-plans"

**反模式**（不要做）：
- ❌ "新功能" → 自动 OpenSpec（太激进，误触率高）
- ❌ "改" → 问"要不要 OpenSpec"（太吵，破坏流畅性）
- ✅ 关键词 → 无条件 OpenSpec
- ✅ 语义 → SUGGEST 一次，附理由
- ✅ 默认 → 静默走 Superpowers

### 底座：Superpowers（14 skills，全量使用）

本项目的**全量工作流底座**。Superpowers 提供从创意到合并的完整流程编排（brainstorming → writing-plans → subagent-driven-dev → review → finish），Sisyphus 的 `<openspec_protocol>` 段负责路由：提到 OpenSpec 关键词 → 走 OpenSpec；默认 → 走 Superpowers。

> 需单独安装：`opencode plugin install superpowers`（详见[前置依赖](#3-openspec-cli可选需要规约驱动变更时)）。本项目**不**自带 Superpowers skill 文件。

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

### 项目级自定义（推荐模式）

我们的项目是**全局层配置**——你装到 `~/.config/opencode/` 后，所有项目都能用。如果想给某个项目加项目级规则，按官方分层加即可：

#### 1. 项目级 `AGENTS.md`（项目专属规则）
在项目根创建 `AGENTS.md`，**与全局 AGENTS.md 合并加载**（项目级优先）：

```bash
cd your-project
cat > AGENTS.md <<'EOF'
# My Project Rules

## 构建命令
- `bun install` 安装依赖
- `bun test` 跑测试
- `bun run build` 构建

## 架构约定
- src/components/ - React 组件
- src/api/ - 后端 API 路由
- tests/ - 单元测试

## Skill 路由（项目级）
本项目用 Sisyphus（不是 build）。默认工作流：
- 启动需求 → Superpowers `brainstorming`
- 写代码 → `lyra` subagent（mid-tier）
- 重复性任务 → `hephaestus` subagent（low-tier）
- 复杂变更 → OpenSpec `/opsx:propose`
- 困难 bug → Superpowers `systematic-debugging` 或 `diagnose` skill
EOF
```

**加载规则**：opencode 从 cwd 向上扫到 git worktree，匹配到的第一个 `AGENTS.md` 优先；找不到时回退到 `~/.config/opencode/AGENTS.md`。

**全局 vs 项目的分工**：
- 全局 AGENTS.md：**个人行为偏好**（语言/系统/注释风格/Emoji）
- 项目级 AGENTS.md：**项目架构/构建命令/项目级 Skill 路由**

#### 2. 项目级 `opencode.json`（合并而非替换）
在项目根创建 `opencode.json`，**与全局 `~/.config/opencode/opencode.json` 合并加载**：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "sisyphus": { "model": "anthropic/claude-opus-4-20250514" }
  }
}
```

**合并规则**：项目级**只覆盖冲突键**；全局的 provider/MCP/plugin 全部保留。所以你装了我们项目后，**不必再配置 provider**——复用全局的就行。

#### 3. 项目级 Skill 加载
opencode 默认会扫描以下 6 个路径：

| 位置 | 优先级 |
|------|--------|
| `.opencode/skills/<name>/SKILL.md` | 项目级（叠加全局） |
| `.claude/skills/<name>/SKILL.md` | 项目级（Claude 兼容） |
| `.agents/skills/<name>/SKILL.md` | 项目级（agent 兼容） |
| `~/.config/opencode/skills/<name>/SKILL.md` | 全局 |
| `~/.claude/skills/<name>/SKILL.md` | 全局（Claude 兼容） |
| `~/.agents/skills/<name>/SKILL.md` | 全局（agent 兼容） |

**所有路径的同名 skill 都会被加载**。如果项目里某个 skill 想覆盖全局同名 skill，**用 `permission` 字段控制可见性**：

```json
// .opencode/opencode.json
{
  "permission": {
    "skill": {
      "karpathy-guidelines": "deny"  // 项目里隐藏全局的
    }
  }
}
```

#### 4. 项目级 Agent 覆盖
如果某个项目想覆盖我们 3 个 agent 的行为，在 `.opencode/agents/` 放同名 `.md`：

```bash
mkdir -p .opencode/agents
cp ~/.config/opencode/agents/sisyphus.md .opencode/agents/sisyphus.md
# 编辑项目级 sisyphus.md（修改 intent_gate 路由等）
```

**加载规则**：项目级同名 agent 覆盖全局。我们的 `install.sh` 只装到 `~/.config/opencode/agents/`——**不会污染项目目录**。

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
├── templates/              # 配置模板
│   └── AGENTS.md           # 全局 AGENTS.md 模板（首次安装时拷贝，不覆盖已有）
├── install.sh              # 一键安装（幂等）
├── uninstall.sh            # 一键卸载
├── CHANGELOG.md            # 变更日志
├── CONTRIBUTING.md         # 贡献指南
├── README.md               # 英文版（GitHub 默认）
├── README.zh-CN.md         # 中文版
└── LICENSE                 # MIT
```

---

## 📄 License

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE)。