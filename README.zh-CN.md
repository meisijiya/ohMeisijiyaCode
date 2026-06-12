# ohMeisijiyaCode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![English](https://img.shields.io/badge/EN-English-blue)](./README.md)
[![中文](https://img.shields.io/badge/中文-Chinese-red)](./README.zh-CN.md)

> 基于 **[Superpowers](https://github.com/obra/superpowers)**（14 个流程编排 skill）的轻量 opencode Agent 系统——**1 + 1 + 1 架构** + **3 档模型路由**（high / mid / low）+ **CLI-first 外部能力**。融合 [Pi Subagents](https://github.com/mattpocock/skills)（前端嵌套 + bash 安全）、[Matt Pocock 诊断三件套](https://github.com/mattpocock/skills)、[karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills)（编码纪律）、[OpenSpec](https://github.com/Fission-AI/OpenSpec)（规约驱动）、[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)（架构灵感）、[RTK](https://github.com/rtk-ai/rtk)（token 压缩）。

---

## 🛒 找领域专用 Skill？（React / Java / Docker 等）

> 我们项目自带 **15 个通用 skill**（流程/工作流导向）。**领域专用 skill**（框架、数据库、语言）我们提供**精选推荐目录**——你用 `npx skills` CLI 自己装。
>
> 📘 **[👉 跳到 `skills-registry/`](skills-registry/README.zh-CN.md)** — 按领域浏览（前端 / 后端 / 数据库 / 运维 / 安全 / 测试），一行命令装。
>
> 🇺🇸 **English**: [`skills-registry/README.md`](skills-registry/README.md)
>
> 🔍 **先去市场找**: [skillsmp.com/zh](https://skillsmp.com/zh) · [ai.codefather.cn/skills](https://ai.codefather.cn/skills)
>
> ⚠️ **装前必读 [⚠️ 安装警告](skills-registry/README.zh-CN.md#⚠️-项目级-skill-安装警告)** — 涵盖重名冲突、token 预算、我们的三层权限模型。

---

## ⚡ 一键安装

```bash
git clone https://github.com/meisijiya/ohMeisijiyaCode.git
cd ohMeisijiyaCode
bash install.sh
```

**安装脚本会自动完成**：

| 自动化项 | 详情 |
|---------|------|
| **3 agents** | `sisyphus.md` / `lyra.md` / `hephaestus.md` → `~/.config/opencode/agents/` |
| **15 skills** | caveman / diagnose / git-workflow-and-versioning / grill-with-docs / handoff / incremental-implementation / interview-me / karpathy-guidelines / mmx-cli-usage / openspec-integration / prototype / source-driven-development / tdd / to-issues / zoom-out |
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

我们的 `grill-with-docs`、`diagnose`、`to-issues`、`tdd`、`handoff`、`zoom-out` 是从 [mattpocock/skills](https://github.com/mattpocock/skills) **原样导入**的（verbatim import）——只取了项目实际需要的 6 个，不是全量 11 个。**不要**另外跑 mattpocock 的官方 setup 脚本，否则同名 skill 会冲突，opencode 按文件系统遍历顺序去重，结果不可预测。

| 方式 | 效果 |
|------|------|
| ✅ 用我们的 `install.sh` | 恰好 6 个，无冲突 |
| ❌ 额外跑 mattpocock 官方 setup | 6 个重名 skill，不确定哪个生效 |

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
| **Context7 CLI (`ctx7`)** | 库文档查询（替代自建 context7-docs 工具）— **免费层：1000 次/月**，预算规则见 `source-driven-development` skill | `npm i -g ctx7 && npx ctx7 setup --opencode` |
| **Playwright CLI (`playwright-cli`)** | 浏览器自动化（替代自建 playwright-browser 工具） | `npm i -g @playwright/cli@latest && playwright-cli install --skills` |

### 本项目自带的 15 个 Skill（`bash install.sh` 自动装）

| Skill | 类型 | 触发 |
|-------|------|------|
| `karpathy-guidelines` | 自研（4 大 karpathy 原则） | orchestrator 自动注入每次 LLM 调用 |
| `openspec-integration` | 自研（OpenSpec ↔ Superpowers 路由桥） | 双层触发：关键词 OR 语义意图（多步/跨 spec） |
| `grill-with-docs` | 从 mattpocock/skills 导入 | 对抗性质询计划 |
| `caveman` | 从 mattpocock/skills 导入 | 超压缩通信（-75% tokens） |
| `diagnose` | 从 mattpocock/skills 导入 | 硬 bug、性能回归 |
| `prototype` | 从 mattpocock/skills 导入 | 一次性原型验证设计 |
| `to-issues` | 从 mattpocock/skills 导入 | 把 plan 拆成独立 issues |
| `mmx-cli-usage` | 自研（mmx CLI 使用指南） | 需要多模态/搜索时 |
| `git-workflow-and-versioning` | 从 addyosmani/agent-skills 原样导入 | Git 工作流：原子提交、分支策略、冲突解决 |
| `incremental-implementation` | 从 addyosmani/agent-skills 原样导入 | 纵向切片实现，补充 tdd |
| `interview-me` | 从 addyosmani/agent-skills 原样导入 | 需求不明（缺 who/why/success/constraint）|
| `source-driven-development` | 轻量复刻 addyosmani skill | 框架/API 决策需要官方文档验证（用 ctx7 CLI）|
| `handoff` | 从 mattpocock/skills 原样导入（`SKILL.md` 15 行）| 将当前对话压缩为交接文档给下一个 agent |
| `tdd` | 从 mattpocock/skills 原样导入（`SKILL.md` + 5 个子文件）| 红-绿-重构循环的测试驱动开发 |
| `zoom-out` | 从 mattpocock/skills 原样导入（`SKILL.md` 7 行）| 放大视野，获取更广上下文和高层视角 |

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

## 🌟 灵感与出处

本项目融合了多个来源的精华。每个导入的 skill 在 frontmatter `metadata.source` / `sourceUrl` 里都标注了出处。

### 基础来源

| 来源 | 借鉴 | 跳过 |
|------|------|------|
| **[Superpowers](https://github.com/obra/superpowers)** | 默认工作流底座（brainstorming → writing-plans → subagent-driven-dev → review → finish） | 不打包 skill 文件（用户 `opencode plugin install`） |
| **[Pi Subagents](https://github.com/mattpocock/skills)** | `permission.task`（深度=3 嵌套）+ `permission.bash` safe-glob | 不导入 Pi agent 配置（opencode 原生） |
| **[Matt Pocock skills](https://github.com/mattpocock/skills)** | 3 个 verbatim 导入：`grill-with-docs`、`diagnose`、`to-issues` | 不跑官方 installer（3 个 skill 冲突风险） |
| **[karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills)** | 4 原则（Think/Simplicity/Surgical/Goal-Driven）| — |
| **[OpenSpec](https://github.com/Fission-AI/OpenSpec)** | 双层触发路由（关键词 + 语义）| 不打包生成的 skill/commands（用户项目里跑 `openspec init`） |
| **[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)** | 架构灵感（orchestrator → specialists）| 不引入 100K+ LOC 或 HTTP 后台子 agent（plugin 模式做不到）|
| **[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)** | 角色权限分层（只读 vs 读写）| 不引入 5+ 专家 agent（保持 3 档）|
| **[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)** | `interview-me`（原样） + `source-driven-development`（轻量复刻）| 不导入全部 23 个 skill（轻量原则）|
| **[RTK](https://github.com/rtk-ai/rtk)** | 推荐用于省 60-90% token | — |

### AI 模型注意力洞察

应用了 [BV1v9ER68EJE](https://www.bilibili.com/video/BV1v9ER68EJE/)（"如何解决AI模型注意力涣散问题"）的启示：

| 洞察 | 应用 |
|------|------|
| **U 型注意力曲线**（>50% context → 只关注末尾）| `<style_guide>` 是 3 agent prompt 的最后段；Sisyphus 末尾 HTML 注释强调"关键尾部提示词"|
| **硬约束词汇**（never/always/must/绝对不要）| 重写 3 agent 的 `style_guide` 用强约束 + 反例/正例 |
| **Skill 文件 ≤ 300-500 行**| 全部 skill 都在 250 行内；Sisyphus 363 行（可接受）|
| **方案 1+2+3+4**（AGENTS.md + Scan + Hooks + 子 Agent 隔离）| 全部有：orchestrator plugin (`experimental.chat.system.transform`) = Hook；子 agent 隔离 = 1+1+1 架构核心 |
| **反被动压缩**（不等质量下降再压缩）| 3 件套验证（`<delegation_review>`）每次调用捕获问题 |
| **软约束 = 没约束** | `bash: *: allow`（项目内信任） + 硬 deny 黑名单（不是"尽量"）|

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

## 🛡️ 权限策略：信任项目，问询外部

按官方权限文档（[opencode permissions](https://opencode.ai/docs/zh-cn/permissions/)）配置，并借鉴 [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) 的"角色权限分层"思想，**细粒度 glob 规则 + opencode 原生 external_directory 机制**。

### 核心设计原则

你打开这个项目 **就是为了让 opencode 干活的**。项目目录 = 信任区。

> - **项目目录内**任何操作 → 默认 allow，不询问
> - **项目目录外**（如 `~/其他`） → opencode 内置 `external_directory: ask` 触发
> - **少数灾难性操作** → 硬 deny（`rm -rf /`、`sudo`、`npm publish` 等）
>
> **Safety net**：opencode 默认的 `build`/`plan` agent 用**出厂保守权限**。担心时切换过去——这是逃生舱口。

### 权限矩阵

| 操作 | Sisyphus | Lyra | Hephaestus |
|------|:--------:|:----:|:----------:|
| `read / grep / glob / webfetch / websearch` | ✅ allow | ✅ allow | ✅ allow（websearch deny）|
| `edit / write` 项目内 | ✅ allow | ✅ allow | ✅ allow |
| `edit / write` 项目外（`external_directory`） | ⚠️ ask | ⚠️ ask | ⚠️ ask |
| `edit / write` `.env*` | ❌ deny | ❌ deny | ❌ deny |
| `bash` 项目内（默认） | ✅ **allow** | ✅ **allow** | ✅ allow |
| `bash` 危险（`rm -rf /`、`sudo`、`mkfs`、`dd`、`chmod -R 777`）| ❌ deny | ❌ deny | ❌ deny |
| `bash` 强制推送/硬重置（`git push --force`/`reset --hard`/`clean -fd`）| ❌ deny | ❌ deny | ❌ deny |
| `bash` 包发布（`npm/pnpm/yarn/cargo publish`、`twine upload`）| ❌ deny | ❌ deny | ❌ deny |
| `task` 委派 | lyra/hephaestus | hephaestus | ❌ deny（叶子）|
| `external_directory`（项目外访问）| ⚠️ ask | ⚠️ ask | ⚠️ ask |
| `doom_loop`（3 次相同调用）| ⚠️ ask（默认）| ⚠️ ask（默认）| ⚠️ ask（默认）|

### 相对 v1 改了什么

| 维度 | v1（旧）| v2（现）|
|------|---------|---------|
| `bash` 默认 Sisyphus/Lyra | `ask`（太谨慎）| **`allow`**（项目信任）|
| 项目外 `edit`/`write` | 自定义 `**/../**` glob（漏报）| `external_directory: ask`（opencode 原生）|
| 安全机制 | 多层 ask 提示 | 切到 `build`/`plan` agent |

### 设计意图（omo-slim 启发）

- **角色权限分层**：omo-slim 按角色给不同 agent 不同默认信任——只读 agent（`explorer`/`librarian`/`oracle`/`observer`）vs 读写 agent（`designer`/`fixer`）。我们也这样：Hephaestus 最宽松（worker 需要大量命令），Sisyphus/Lyra 中等（默认 allow + 硬 deny 黑名单），`build`/`plan` 最保守（opencode 出厂默认）。
- **别让 agent 谨慎——让安全网触手可及**：用户随时可以切换到更保守的 agent。**不要用频繁询问惩罚正常流程**。
- **硬 deny 不可替代**：再宽松的 agent 也必须有 `rm -rf /`/`sudo`/`npm publish` 等硬 deny——这些规则**不能被任何 override**。

### 模式匹配示例

```yaml
# 这些 glob 模式的工作方式：
bash:
  "*": allow                          # 默认：项目内所有 bash 命令 allow
  "rm -rf /*": deny                   # 硬 deny
  "sudo *": deny                      # 硬 deny
  "git push --force *": deny          # 硬 deny
  "npm publish *": deny               # 硬 deny
external_directory: ask              # 任何 escape cwd 的操作都 ask
```

**Last-rule-wins**：每个 permission 块中**最后匹配的规则优先**。所以把 `"*": allow` 放最前，具体 deny 放后面。

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
| **caveman** | mattpocock/skills | 超压缩通信（-75% tokens） | Sisyphus / Lyra |
| **diagnose** | mattpocock/skills | 硬 bug、性能回归（6 阶段循环） | Lyra（主场景） |
| **prototype** | mattpocock/skills | 一次性原型验证设计 | Sisyphus / Lyra |
| **to-issues** | mattpocock/skills | 把 plan/spec 拆成独立 issues | Sisyphus |
| **git-workflow-and-versioning** | addyosmani/agent-skills（原样导入）| Git 工作流：原子提交、分支策略、冲突解决 | Sisyphus / Lyra |
| **incremental-implementation** | addyosmani/agent-skills（原样导入）| 纵向切片实现，补充 tdd | Sisyphus / Lyra |
| **interview-me** | addyosmani/agent-skills（原样导入）| 需求不明确（缺 who/why/success/constraint）—— 一次问一个问题直到 95% 置信度 | Sisyphus |
| **source-driven-development** | addyosmani/agent-skills（轻量复刻）| 框架/API 决策需要官方文档验证（用 ctx7 CLI）| Lyra（实现时）|
| **handoff** | mattpocock/skills（原样导入）| 将当前对话压缩为交接文档给下一个 agent | Sisyphus / Lyra |
| **tdd** | mattpocock/skills（原样导入）| 红-绿-重构循环的测试驱动开发 | Sisyphus / Lyra |
| **zoom-out** | mattpocock/skills（原样导入）| 放大视野，获取更广上下文和高层视角 | 全部 |

### 用户面 Skills：`handoff` 和 `zoom-out`

这两个 skill 是**给用户用的，不是给 agent 系统用的**。它们桥接"你的 session"和"agent 的心智模型"。

#### `handoff` — 跨 session 续接

**功能**：把当前对话压缩为交接文档，让新 session（或不同设备）能从你离开的地方继续。

**何时用**（用户主动触发）:
- 🌙 **长任务**：昨晚开个头，今天要继续
- 📱 **跨设备**：PC 切到手机（或反过来）
- 🔄 **切换工具**：opencode TUI → Web UI / IDE 插件
- 👥 **交接给同事**：另一个开发者要接手

**何时不要用**（反模式）:
- ❌ **子 agent 委派** — 那是 Sisyphus → Lyra → Hephaestus，用 `<delegation_protocol>`（不是 handoff）
- ❌ **当前 session 内总结** — 直接让 agent 总结就行
- ❌ **"保存我的工作"** — 那用 git commit（`git-workflow-and-versioning`）

**用法**:
```bash
/handoff "手机端继续 auth 重构，看 src/auth/refresh.js"
# 或
/handoff
```

agent 写入交接文档到 OS 临时目录（Linux 上如 `/tmp/handoff-...md`），含:
- 任务状态（进行中 / 阻塞 / 完成）
- 关键文件路径和决策
- **建议下个 session 调用的 skill**
- 敏感信息已脱敏

#### `zoom-out` — 3 万英尺看代码

**功能**：当你不熟代码时，agent 给出高层地图：模块、调用方、领域术语。

**何时用**（用户主动触发 — `disable-model-invocation: true`）:
- 🆕 **新项目入门**：刚 clone 仓库
- 🔍 **review PR**：批准前要全局
- 🐛 **跨模块 bug 调试**：看清系统边界
- 🤔 **"X 怎么工作的？"**：通用代码理解

**何时不要用**:
- ❌ **自动触发** — 永远不会（设计上）
- ❌ **单函数深挖** — 直接读代码
- ❌ **外部 API 查文档** — 用 `source-driven-development`

**用法**:
```
你：auth flow 看不懂。zoom out 一下。
agent: [auth 模块、调用方、领域术语地图]
```

#### 为什么这俩特别

| 维度 | handoff | zoom-out |
|------|---------|----------|
| 触发 | **必须用户触发** | **必须用户触发** |
| 为什么 | session 是用户驱动的 | 代码理解是用户驱动的 |
| 自动触发风险 | 开了会刷屏 agent 输出 | 开了会污染响应 |
| 3 agent 集成 | ❌ 无（仅用户）| ⚠️ 跨 agent 可用，但不自动 |

两者都带 `disable-model-invocation: true`（或用 user-named action）—— agent 永远不会主动用。

### OpenSpec 集成（项目级规约驱动）

| Command | 功能 | 谁用 |
|---------|------|------|
| `/opsx:propose` | 创建 change 提案 | Sisyphus / Lyra |
| `/opsx:explore` | 自由探索 | Sisyphus / Lyra |
| `/opsx:apply` | 实施 tasks.md | Lyra（委派执行） |
| `/opsx:sync` | 合并 delta → 主 spec | Sisyphus |
| `/opsx:archive` | 归档完成的 change | Sisyphus |

**Hephaestus 全部绕过 OpenSpec**——CRUD 不需要规约。

### 🛡️ 为什么我们不全面依赖 OpenSpec

OpenSpec 是我们架构中**三层正交**之一。我们**不依赖**它，而是**共存**。

```
┌──────────────────────────────────────────────────────────────┐
│ 第1层：调度（我们的 3 个 agent）                              │
│  Sisyphus / Lyra / Hephaestus — 意图路由 + 委派              │
│  "谁做什么？"                                                 │
├──────────────────────────────────────────────────────────────┤
│ 第2层：工作流（我们的 15 个 skill + Superpowers）              │
│  karpathy / grill-with-docs / diagnose / interview-me / ...  │
│  Superpowers（14 skills, opencode 插件）                     │
│  "我们怎么干活？"                                             │
│  → **99% 任务走这层**                                        │
├──────────────────────────────────────────────────────────────┤
│ 第3层：应用（OpenSpec，可选）                                │
│  /opsx:propose / :apply / :sync / :archive                    │
│  openspec-propose / openspec-apply-change / ...                │
│  "我们在造什么？"                                             │
│  → **~1% 任务**：复杂多 spec 变更 + 审计                     │
└──────────────────────────────────────────────────────────────┘
```

**为什么这样设计**：

1. **无单点故障**——OpenSpec 出问题只影响第 3 层。99% 工作仍走 1+2 层
2. **无命名冲突**——我们的 `openspec-integration` skill 跟项目级 5 个 `openspec-*` skill **不同名**，共存无冲突
3. **无默认漂移**——第 2 层是默认。OpenSpec 是**触发型**（关键词 OR 语义）
4. **逃生舱口**——切到 `build`/`plan`（opencode 出厂）完全绕过 OpenSpec

### OpenSpec 实际触发频次

| 任务类型 | % | 哪层 |
|---------|---|------|
| Daily CRUD（增删改查）| 60% | 第 2 层（Superpowers）|
| 调研/简单实现 | 25% | 第 2 层（karpathy + source-driven）|
| 跨文件实现 | 10% | 第 1 层（Lyra）|
| 困难 bug | 3% | 第 1 层（Lyra + diagnose）|
| **多 spec 变更 + 审计** | **1%** | **第 3 层（OpenSpec）**|

即使 5 个 `openspec-*` skill 每次 LLM 调用都加载，*操作本身*（触发后）< 1% 工作量。token 预算由第 2 层主导。

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

### 📖 领域 Skills 目录（仅指导，不自带安装）

我们不自带领域 skill 的自动化安装。详见 [`skills-registry/`](skills-registry/) —— 指导性推荐目录：

| 领域 | 文件 | 主要仓库 |
|------|------|----------|
| React/Next.js | [`skills-registry/frontend-react.md`](skills-registry/frontend-react.md) | vercel-labs/agent-skills, PatternsDev/skills |
| Vue/Nuxt | [`skills-registry/frontend-vue.md`](skills-registry/frontend-vue.md) | vuejs-ai/skills, PatternsDev/skills |
| UI/UX 设计 | [`skills-registry/frontend-design.md`](skills-registry/frontend-design.md) | nextlevelbuilder/ui-ux-pro-max, anthropics/skills |
| Java/Spring Boot | [`skills-registry/backend-java.md`](skills-registry/backend-java.md) | antigravity-awesome-skills, Jeffallan/claude-skills |
| Python/FastAPI/Django | [`skills-registry/backend-python.md`](skills-registry/backend-python.md) | Skill_Seekers, antigravity-awesome-skills |
| SQL & NoSQL | [`skills-registry/database.md`](skills-registry/database.md) | supabase/agent-skills, antigravity-awesome-skills |
| Docker/K8s/CI-CD | [`skills-registry/devops.md`](skills-registry/devops.md) | antigravity-awesome-skills |
| 安全与认证 | [`skills-registry/security.md`](skills-registry/security.md) | trailofbits/skills, squirrelscan/skills |
| E2E/性能测试 | [`skills-registry/testing.md`](skills-registry/testing.md) | browser-use, vercel-labs/agent-browser |

安装命令：`npx skills add <owner/repo> --skill <name> -a opencode -g -y`

这些是**领域知识型** skill，与我们 11 个**流程型** skill（karpathy、diagnose、tdd 等）互补，无重叠。

---

## 📦 组件清单

| 组件 | 类型 | 数量 | 来源 |
|------|------|------|------|
| Agents | `.md` prompt 文件 | **3** | 自研 |
| Skills | `SKILL.md` 文件 | **15** | 3 自研 + 12 外部导入（8 来自 mattpocock + 3 来自 addyosmani + 1 轻量复刻 addyosmani） |
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

## 📐 压缩策略（340K 触发点）

> **为什么**：1M 上下文模型在 ~340K token 之后**注意力涣散**。长上下文 = 贵 + 差。我们在 340K 附近压缩。

**参考**：AI 注意力 U 形曲线研究——见 [压缩策略文档](docs/2026-06-11-compaction-strategy-340k.md)

### opencode 1.16.2 Schema（已对照 `https://opencode.ai/config.json` 验证）

`compaction` 块有 **5 个官方字段**。**没有"compaction threshold"字段**——触发由内部计算：

```
触发点 ≈ 模型上下文 - reserved - preserve_recent_tokens
```

### 我们的默认配置

```jsonc
{
  "compaction": {
    "auto": true,                  // 自动触发
    "prune": true,                 // 修剪旧工具输出
    "reserved": 100000,            // ⬇ 从 300K（原本吃了 30% 窗口）
    "preserve_recent_tokens": 40000,  // ⬇ 从 64K
    "tail_turns": 1                // ⬇ 从默认 2
  },
  "agent": {
    "compaction": {
      "prompt": "激进压缩：30K 输出，仅保留关键信息..."
    }
  }
}
```

### 各模型触发点

| 模型 | 上下文 | 触发点 | 说明 |
|------|-------|--------|------|
| **MiniMax-M3**（Sisyphus）| 512K | **~372K** | ✅ 接近 340K 目标 |
| **deepseek-v4-flash**（Lyra/Hephaestus）| 1M | ~860K | 激进 prompt 让 session 远离 860K |

Sisyphus 主 agent **372K 触发 ≈ 340K 目标**——你指定的甜点。

1M 模型 schema 极限 ≈ 860K。我们用 **激进压缩 prompt** 解决：压缩后 30K，需要 5 倍时间才涨回去。

### 为什么重要

| 不调 | 调了 |
|------|------|
| 触发点 ~636K（1M 模型）| 触发点 ~860K + 压缩后保持短 |
| 1M session = 10x 成本（vs 100K）| 30K 压缩后 = 3x 成本 |
| 400K 后注意力涣散 | 全程注意力保真 |

完整细节见 [压缩策略文档](docs/2026-06-11-compaction-strategy-340k.md)。

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

## 🔄 维护：上游 Skill 同步

> **我们 15 个全局 skill 中有 11 个来自上游**（mattpocock/skills, addyosmani/agent-skills）。每个来源都在 [`skills/SOURCES.yaml`](skills/SOURCES.yaml) 留档，并附带检查+更新脚本。

### Skill 来源汇总

| 类型 | 数量 | 更新策略 |
|------|------|---------|
| **self**（无上游）| 3 个（karpathy, openspec, mmx-cli）| N/A |
| **verbatim**（100% 原样）| 11 个（mattpocock + addyosmani）| ✅ 自动检查 + 安全应用 |
| **reimpl**（轻量复刻）| 1 个（source-driven-development）| ⚠️ 需手动 review |

### 检查上游 drift

```bash
# 默认：只检查（安全，不改任何东西）
bash scripts/update-skills.sh

# 预览会改什么（不真写）
bash scripts/update-skills.sh --dry-run

# 应用所有 verbatim 更新
bash scripts/update-skills.sh --apply

# 检查特定 skill
bash scripts/update-skills.sh --skill grill-with-docs
```

**退出码**：
- `0` = 全部最新
- `1` = 检测到 drift（检查模式）
- `2` = 网络/认证错误

### 工作原理

1. **读取** `skills/SOURCES.yaml`（15 个 skill，各含 source_repo + source_path）
2. **拉取** 来自各上游的最新 SKILL.md（用 `api.github.com` 绕过 `raw.githubusercontent.com` 超时）
3. **对比** 本地 + 上游内容的 SHA-256
4. **报告** drift（或用 `--apply` 应用）
5. **绝不**自动更新 reimpl skill（需手动 review）

### 注册表格式

```yaml
- name: grill-with-docs
  type: verbatim
  source_repo: mattpocock/skills
  source_path: skills/engineering/grill-with-docs/SKILL.md
  imported_at: 2026-06-10
  lines: 88
```

> **新加导入的 skill？** 在 `skills/SOURCES.yaml` 加一条，下次 drift 检查就会扫描到。

### 推荐 Skill（`skills-registry/` 目录）

[`skills-registry/`](skills-registry/) 下 10 个文件推荐各领域专用 skill，供用户自助安装。这些推荐**精选自 3 个主要源**：

| 源 | 提供内容 | 用于哪些文件 |
|----|---------|-------------|
| 🇨🇳 [程序员鱼皮 — 40 Agent Skills 精选资源](https://www.cnblogs.com/yupi/p/19608327) | 多领域精选（前端/后端/AI/运维）| 全部 10 个 |
| 🇨🇳 [鱼皮 AI 导航 Skills 专区](https://ai.codefather.cn/skills) | 中文技能市场，国内访问友好 | `frontend-react.md`, `backend-java.md`, `tools.md` |
| 🇨🇳 [技术站 — Java 技术栈 Skills 全景指南](https://jishuzhan.net/article/2062777085067866114) | Java 生态深度 | `backend-java.md`, `database.md` |
| 🇺🇸 [vercel-labs/skills](https://github.com/vercel-labs/skills) | CLI 本身 + `agent-skills` 仓库（前端设计）| 全部 10 个（作为安装器）|
| 🇹🇷 [yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) | 从文档/repo/PDF 生成 skill | `tools.md` |

> **每个 `skills-registry/<领域>.md` 文件** 列出具体 skill，含：
> - 来源 repo（如 `vercel-labs/agent-skills`）
> - 安装命令（`npx skills add <repo> --skill <name> -a opencode -g`）
> - "为什么跟我们体系互补" 的说明
>
> **为什么这些不自动检查 drift？** 因为我们不装——用户自己装。如果某个推荐 skill 死了，从文件里删掉那条即可。

### 实际维护工作流

```bash
# 每月：检查 15 个全局 skill 是否有上游更新
bash scripts/update-skills.sh

# 如果发现 drift，先预览会改什么
bash scripts/update-skills.sh --dry-run

# 如果 diff 满意，应用（只针对 verbatim skill）
bash scripts/update-skills.sh --apply

# 验证无 drift 残留
bash scripts/update-skills.sh  # 应显示 0 drift，exit 0

# 提交更新
git add skills/ && git commit -m "chore(skills): sync N verbatim skills with upstream"
```

**本次会话最后运行**：
- 检测到：2 个 drift（caveman, interview-me）
- 已应用：2 个 verbatim 更新
- 复查：0 drift，11/11 verbatim 全部最新 ✅

---

## 📁 仓库结构

```
ohMeisijiyaCode/
├── agents/                 # 3 agent prompt 文件
│   ├── sisyphus.md         # primary (high-tier) — 7 XML segments + 9-row routing
│   ├── lyra.md             # subagent (mid-tier) — can delegate to Hephaestus
│   └── hephaestus.md       # subagent (low-tier) — task:deny, bash safe-glob
├── skills/                 # 15 个 skill（SKILL.md）
│   ├── caveman/                  # 来自 mattpocock（超压缩通信）
│   ├── diagnose/                 # 来自 mattpocock
│   ├── git-workflow-and-versioning/ # 来自 addyosmani（git 工作流）
│   ├── grill-with-docs/          # 来自 mattpocock
│   ├── handoff/                  # 来自 mattpocock（SKILL.md 15 行）
│   ├── incremental-implementation/ # 来自 addyosmani（纵向切片）
│   ├── interview-me/            # 来自 addyosmani（原样，一次一问）
│   ├── karpathy-guidelines/      # 4 大 karpathy 原则（自动注入）
│   ├── mmx-cli-usage/            # mmx CLI 指南
│   ├── openspec-integration/     # OpenSpec ↔ Superpowers 路由桥
│   ├── prototype/                # 来自 mattpocock（一次性探索）
│   ├── source-driven-development/ # 轻量复刻 addyosmani skill
│   ├── tdd/                      # 来自 mattpocock（SKILL.md + 5 个子文件）
│   ├── to-issues/                # 来自 mattpocock
│   └── zoom-out/                 # 来自 mattpocock（SKILL.md 7 行）
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