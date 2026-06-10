---
name: openspec-integration
description: Routing bridge that clarifies when to use OpenSpec workflows (propose/explore/apply/sync/archive) vs Superpowers (brainstorming/writing-plans/review/finish-branch). Load when the user mentions "propose / explore / apply / sync / archive" — these are OpenSpec's commands. Complements but does NOT replace Superpowers.
license: MIT
metadata:
  purpose: "Boundary documentation between OpenSpec and Superpowers"
  triggeredBy: "User mentions propose/explore/apply/sync/archive, OR wants to track a multi-step spec-driven change"
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

## 🎯 触发条件

仅当用户**明确说以下关键词**时加载此 skill：

| 关键词 | OpenSpec 命令 | 何时用 |
|--------|--------------|--------|
| "提议 X / propose X" | `/opsx:propose` | 创建一个新 change 提案 |
| "探索 X / explore X" | `/opsx:explore` | 自由探索（不落 artifact） |
| "应用 X / apply X" | `/opsx:apply` | 实施 tasks.md |
| "同步规约 / sync specs" | `/opsx:sync` | 智能合并 delta 到主 spec |
| "归档 X / archive X" | `/opsx:archive` | 归档完成的 change |

如果用户没明确说这些词，**默认走 Superpowers**。

## 📂 项目级结构

OpenSpec init 在本项目创建了：

```
myOpenCodeWithMEeee/
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

## 🛡️ 不混用原则

| 用户说 | 走哪个 |
|--------|--------|
| "做 brainstorming" / "按规范流程" | Superpowers |
| "做 OpenSpec" / "提议 change" / "归档" | OpenSpec |
| "按 [plan] 实施" | Superpowers subagent-driven-development |
| 默认 | Superpowers（除非显式提到 OpenSpec 关键词） |

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
