---
name: openspec-integration
description: Routing bridge that clarifies when to use OpenSpec workflows (propose/explore/apply/sync/archive) vs Superpowers (brainstorming/writing-plans/review/finish-branch). Use a two-layer trigger: (1) STRONG — user explicitly says "propose/提议/应用/归档/etc." → always OpenSpec. (2) SEMANTIC — task semantically matches multi-step spec-driven change criteria → SUGGEST OpenSpec and ask user. Default to Superpowers if neither matches. Complements but does NOT replace Superpowers.
license: MIT
metadata:
  purpose: "Boundary documentation between OpenSpec and Superpowers"
  triggeredBy: "Two-layer: (1) keyword (propose/explore/apply/sync/archive/提议/探索/应用/同步/归档) → strong trigger. (2) semantic intent (multi-step change, cross-spec impact, change tracking, brownfield legacy) → suggest and ask user"
---

# OpenSpec ↔ Superpowers 路由桥

## ⚠️ 关键边界

OpenSpec **不替代** Superpowers 的：
- `brainstorming` — 意图探索仍走 Superpowers
- `writing-plans` — 任务级 plan 仍走 Superpowers
- `subagent-driven-development` — 执行仍走 Superpowers
- `requesting-code-review` / `receiving-code-review` — 两级审查仍走 Superpowers
- `finishing-a-development-branch` — git worktree 收尾仍走 Superpowers

OpenSpec **补充** Superpowers 没有的能力：
- 多 Change 并行跟踪（DAG 拓扑排序）
- Spec 智能合并（ADDED/MODIFIED/REMOVED delta → 主 spec）
- 需求变更追踪（哪个 spec 改了、影响哪些 task）
- 项目级规约中心（`openspec/specs/<domain>/spec.md`）

## 🎯 触发条件（双层）

OpenSpec 触发采用**双层机制**——避免误触的同时减少用户学习成本。

### Layer 1: 强触发（关键词）—— 无条件走 OpenSpec

用户**明确说**以下关键词时，**直接走 OpenSpec**，不再询问：

| 关键词（中/英） | OpenSpec 命令 | 何时用 |
|----------------|--------------|--------|
| "提议 X / propose X" | `/opsx:propose` | 创建一个新 change 提案 |
| "探索 X / explore X" | `/opsx:explore` | 自由探索（不落 artifact） |
| "应用 X / apply X" | `/opsx:apply` | 实施 tasks.md |
| "同步规约 / sync specs" | `/opsx:sync` | 智能合并 delta 到主 spec |
| "归档 X / archive X" | `/opsx:archive` | 归档完成的 change |
| "change" / "变更" / "提案" / "规约" | 任意 OpenSpec 操作 | 涉及 spec 追踪 |

### Layer 2: 语义触发（建议）—— SUGGEST 并询问用户

**任务语义匹配**以下任一条件时，**SUGGEST** OpenSpec 给用户，让用户决定：

| 语义信号 | 例子 | 触发的 OpenSpec 价值 |
|---------|------|-------------------|
| **多步变更** | "重构 auth + 改 user model + 改 API" | 跨多 spec 的 delta 合并 |
| **跨 spec 影响** | "改 X 会影响 Y 吗？" | change DAG 追踪 |
| **需求变更追踪** | "这个 spec 改了哪些 task？" | 需求 ↔ 实现映射 |
| **brownfield 改造** | "在老项目里加新功能" | OpenSpec 对 brownfield 友好 |
| **audit / 复盘** | "上个月做的 X 在哪？" | archive 查询 |
| **多 change 并行** | "同时做 2 个独立 change" | 多个 openspec/changes/ 文件夹 |
| **新项目初始化** | "我想建个新项目" | `openspec init` + 初始 spec |

**SUGGEST 模板**（直接告诉用户）：
> "这个任务看起来涉及[多步变更/跨 spec 影响/...]——OpenSpec 比较擅长这个。
> 要走 OpenSpec（先写 proposal.md）还是 Superpowers（直接 brainstorming）？
> - 走 OpenSpec: 我会创建 `openspec/changes/X/` 并写 proposal.md
> - 走 Superpowers: 我会直接 brainstorming + writing-plans"

### Layer 3: 默认（不触发）—— 走 Superpowers

如果既没关键词、也没语义匹配，**默认走 Superpowers**——OpenSpec 价值不大，不强加。

例子（不触发）：
- "修改 README 一行错别字" → Superpowers 直接改
- "跑一下测试" → Superpowers 直接 bash
- "看看 X 文件内容" → Superpowers 直接 read

### 双层触发的优势

- **减少学习成本**：用户不用背 5 个 OpenSpec 命令
- **避免误触**：daily CRUD 不会被 OpenSpec "绑架"
- **可预测**：关键词触发 100% 准确；语义触发有兜底问句

### 反模式（不要做）

| 反模式 | 后果 |
|--------|------|
| ❌ 看到 "新功能" 就自动走 OpenSpec | 误触率高，用户困惑 |
| ❌ 看到 "改" 就问"要不要 OpenSpec" | 噪音大，破坏流畅性 |
| ❌ 忽略关键词，强行走 Superpowers | 用户明确说"提议"你没走，他崩溃 |
| ✅ 关键词 → 直接走，无视其他 | 强触发要无条件 |
| ✅ 语义 → SUGGEST 一次，附理由 | 给用户决策权 |
| ✅ 默认 → 静默走 Superpowers | 不打扰 |

## 🛡️ 防偏向 OpenSpec 保障

**核心原则：OpenSpec 是少数场景工具，不是默认。**

我们项目**不**完全倾向 OpenSpec。三层架构正交：

```
┌──────────────────────────────────────────────────────────────┐
│ 调度层（我们项目）                                            │
│  Sisyphus / Lyra / Hephaestus                                  │
│  - 意图路由（intent_gate）                                    │
│  - 派发协议（delegation_protocol）                              │
│  - 验证协议（delegation_review 三件套）                        │
├──────────────────────────────────────────────────────────────┤
│ 工作流层（我们项目 + Superpowers）                              │
│  karpathy / grill-with-docs / diagnose / to-issues             │
│  interview-me / source-driven-development                      │
│  Superpowers (14 skills, opencode 插件)                        │
│  - **默认走这层**（daily CRUD、调研、简单实现）              │
├──────────────────────────────────────────────────────────────┤
│ 应用层（OpenSpec，可选）                                      │
│  /opsx:propose / :apply / :sync / :archive                    │
│  openspec-{propose,apply,change,...} skills                  │
│  - 仅在用户明确触发 / 语义匹配时使用                          │
│  - **不到 1% 任务需要这层**                                   │
└──────────────────────────────────────────────────────────────┘
```

### 实际触发频次估计

| 任务类型 | % | 走哪层 |
|---------|---|--------|
| Daily CRUD（增删改查）| 60% | 工作流层（Superpowers）|
| 调研 / 简单实现 | 25% | 工作流层（karpathy + source-driven）|
| 复杂实现 / 跨文件 | 10% | 调度层（Lyra）|
| 困难 bug | 3% | 调度层（Lyra + diagnose）|
| 复杂变更 / 跨 spec / 审计 | **1%** | **应用层（OpenSpec）**|

**OpenSpec 只占 ~1% 任务**。即使每次 OpenSpec 操作触发 `opsx-propose` 等 5 skill 加载到 LLM 工具列表，**总体 LLM token 消耗仍以工作流层为主**。

### 三层互不替代

| 你想做的事 | 用什么 | 走哪层 |
|-----------|--------|--------|
| 写一行 bug fix | 直接改 | 调度层（Sisyphus self）|
| 写 5 个 CRUD 文件 | 委派 Hephaestus | 调度层 |
| 重构 auth 系统 | brainstorming → plans → execute | 工作流层（Superpowers）|
| 引入一个全新第三方库 | 查 ctx7 + 实现 | 工作流层（source-driven）|
| **新功能 + 改多个 spec + 跨服务影响** | **propose → review → apply → sync** | **应用层（OpenSpec）**|

### 防止 OpenSpec "侵蚀" 默认行为

| 风险 | 缓解 |
|------|------|
| LLM 误触发 `/opsx:propose` 因为 prompt 里有 OpenSpec 关键词 | Sisyphus 必须**明确说** propose/apply/sync/archive（Layer 1 强触发）才走 |
| 项目级 `openspec init` 生成的 skill 污染全局 | 我们的 `openspec-integration` skill **没有**同名（不是 `openspec-propose`）——共存无冲突 |
| 5 个 OpenSpec skill 全加载占 token | 默认情况下，**只有用户明确触发 /opsx:* 时**才关注；日常任务 LLM 看到它们但不会调 |
| 用户想"切回 Superpowers" | 切到 `build` 或 `plan` agent（opencode 出厂保守）——OpenSpec 触发不到 |

## 📂 项目级结构

OpenSpec init 在本项目创建了：

```
ohMeisijiyaCode/
├── openspec/
│   ├── specs/                  # 主题级主 spec（单一事实源）
│   │   └── <domain>/spec.md
│   ├── changes/                # 进行中的 change（含 archive/）
│   │   ├── <change-id>/
│   │   │   ├── proposal.md     # 是什么 + 为什么
│   │   │   ├── design.md       # 怎么实现
│   │   │   ├── tasks.md        # 实施步骤
│   │   │   └── specs/          # delta spec（ADDED/MODIFIED/REMOVED）
│   │   └── archive/            # 已完成的 change
│   └── AGENTS.md               # OpenSpec 自己的 AI 行为指引
└── .opencode/
    ├── skills/openspec-*/SKILL.md  # 自动生成的 5 个 skill
    └── commands/opsx-*.md          # 自动生成的 5 个 command
```

## 🔄 标准工作流

```
1. User: "提议一个新功能 X"
   → Load this skill
   → 加载 openspec-propose skill
   → Run: /opsx:propose X
   → Output: openspec/changes/X/{proposal,design,tasks}.md
   → 委派 Lyra 子 agent 分析 tasks.md 的可行性
   → Main agent 决策后开始 implement

2. User: "应用 change X"
   → Load this skill
   → 加载 openspec-apply-change skill
   → Run: /opsx:apply X
   → 读 openspec/changes/X/tasks.md
   → 实施每个 task，勾选 checkbox
   → Run: /opsx:sync X（智能合并 delta 到 openspec/specs/）
   → Run: /opsx:archive X（归档完成的 change）

3. User: "归档 change X"
   → Load this skill
   → 加载 openspec-archive-change skill
   → Run: /opsx:archive X
   → Move openspec/changes/X/ → openspec/changes/archive/2026-06-09-X/
   → Optional: 调 Superpowers finishing-a-development-branch
```

## 🛡️ 不混用原则（双层触发版）

| 用户说 | 走哪个 |
|--------|--------|
| "提议/propose/explore/apply/sync/archive" | **OpenSpec 强触发**（Layer 1） |
| 任务语义匹配（多步/跨 spec/审计/...） | **OpenSpec SUGGEST** + 询问用户（Layer 2） |
| "做 brainstorming" / "按规范流程" | Superpowers |
| "按 [plan] 实施" | Superpowers subagent-driven-development |
| 默认（无关键词 + 无语义） | Superpowers |

## ⚠️ 失败处理（优雅降级策略）

### 检测优先级（先检查再决定降级）

在执行任何 OpenSpec 操作前，按顺序检查 3 项：

#### 1. CLI 是否存在？
```bash
command -v openspec
# exit 0 → 有；非零 → 缺
```

#### 2. 当前项目是否已 init？
```bash
test -d openspec/ && test -d openspec/specs && test -d openspec/changes
# 全 true → 已 init；否则未 init
```

#### 3. 目标 change 是否存在？（apply/archive/sync 时）
```bash
test -d openspec/changes/<change-id>/
```

### 4 种失败场景的兜底矩阵

| 场景 | 检测结果 | 兜底行为 |
|------|---------|---------|
| **A. CLI 缺失** | `command -v openspec` 失败 | ⏭️ **降级到 Superpowers 流程**：用 `brainstorming` + `writing-plans` + `subagent-driven-development` 替代 `/opsx:propose`+`apply`。明确告诉用户："OpenSpec CLI 未安装，已降级到 Superpowers 工作流。安装方法：`npm i -g @fission-ai/openspec`" |
| **B. CLI 存在但项目未 init** | CLI 在但 `openspec/` 目录不存在 | 🛠️ **询问用户后自动 init**：告诉用户 "当前项目未 init OpenSpec。要现在跑 `openspec init --tools opencode` 吗？" 用户同意后执行，然后继续。 |
| **C. CLI 存在 + 已 init + 目标 change 缺失** | apply/archive 找不到 change | ❌ **不要硬编**：告诉用户 "找不到 change `<id>`。当前存在的 change：`openspec/changes/*/`"。让用户用 `ls openspec/changes/` 确认后重试。 |
| **D. change 结构损坏** | proposal.md/tasks.md 缺失或解析失败 | 🚨 **报告损坏 + 建议 validate**："change `<id>` 结构损坏（缺少 proposal.md）。建议跑 `openspec validate <id>` 修复。" 不要尝试重写文件——交给用户决定。 |

### 核心原则

- **不要硬编 fallback 文件**：OpenSpec 的 artifacts（proposal.md/specs/tasks.md）必须真实——**不能用替代品**（"没有 proposal.md 就用 tasks.md 代替"是错的）
- **不要 silent 降级**：降级到 Superpowers 时**必须明确告诉用户**——否则他们不知道 OpenSpec 没工作
- **不要问太多**：场景 A 直接降级 + 一次性提示安装命令；场景 B 询问一次；场景 C/D 给出具体错误让用户决定
- **元数据优先**：检测顺序是 `CLI → init → change 存在 → change 完整`，前一项缺失就直接走兜底，不继续往下

### 给 Sisyphus 的硬规则

收到用户 "提议 X" / "应用 X" 等 OpenSpec 触发词时：
1. **必先检测** CLI 和 init 状态（不要直接调命令）
2. **降级方案要明确告诉用户**——不是 silently 走另一条路
3. **决不伪造 artifacts**——OpenSpec 的价值就在于真实的、可审计的 change 流程

## 🤝 与 Sisyphus（主 agent）协作

Sisyphus 不应自己直接调 openspec CLI 写文件；它应：
1. Load this skill
2. 用自然语言告诉 Lyra "读 openspec/changes/X/proposal.md 并分析可行性"
3. Lyra 返回 `<results>` 块
4. Sisyphus 决策后，用 `write` 工具写新文件或用 `hashline-edit` 改现有文件
