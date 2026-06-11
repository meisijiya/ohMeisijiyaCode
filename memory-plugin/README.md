# ⚠️ memory-plugin — BETA

> **⚠️ 此插件处于 BETA 状态。** 可能影响会话稳定性（UI 卡顿、LLM 不启动），建议在**非生产项目**中试用。
>
> **⚠️ This plugin is in BETA.** It may affect session stability (UI freezes, LLM startup failure). Try it on **non-production projects** first.

---

## 📋 目录 | Table of Contents

- [简介 | Introduction](#-简介--introduction)
- [状态 | Status](#-状态--status)
- [安装 | Install](#-安装--install)
- [卸载 | Uninstall](#-卸载--uninstall)
- [配置 | Configuration](#-配置--configuration)
- [风险评估 | Risk Assessment](#-风险评估--risk-assessment)
- [已知 Bug 历史 | Known Bug History](#-已知-bug-历史--known-bug-history)
- [架构 | Architecture](#-架构--architecture)

---

## 📖 简介 | Introduction

**中文：** memory-plugin 是 opencode 1.16.2 的可插拔长期记忆插件。它通过关键词匹配自动注入 `MEMORY.md` 中的项目级决策/教训到 LLM 输入（`chat.message` 钩子），并通过 `[SAVE_MEMORY]` 标记自动存储新的决策到 `MEMORY.md`（`experimental.text.complete` 钩子）。

**English:** memory-plugin is a pluggable long-term memory plugin for opencode 1.16.2. It injects project-level decisions/lessons from `MEMORY.md` into LLM input via keyword matching (`chat.message` hook), and automatically saves new decisions to `MEMORY.md` via `[SAVE_MEMORY]` markers (`experimental.text.complete` hook).

---

## 📊 状态 | Status

| Dimension | Status |
|-----------|--------|
| ✅ Verified | `chat.message` hook (read), `experimental.text.complete` hook (save), retry logic with backoff, [SAVE_MEMORY] parsing |
| ⚠️ 1.16.2 lock | Uses internal plugin API that may change between opencode versions |
| ⚠️ Keyword-only | Retrieval is regex-based (Chinese keywords). No vector/semantic search |
| ❌ No session continuation | Plugin stateless — each message processed independently |

---

## 💾 安装 | Install

### Prerequisites
- opencode 1.16.2+
- Bun (for building from source)
- `MEMORY.md` at project root (will be auto-detected)

### Quick Install

```bash
cd /path/to/your/project
chmod +x memory-plugin/install.sh
./memory-plugin/install.sh
```

**What it does:**
1. Compiles `src/memory-plugin.ts` → `dist/memory-plugin.js`
2. Creates symlink: `.opencode/plugins/memory-plugin.js` → `memory-plugin/dist/memory-plugin.js`
3. Checks if `MEMORY.md` exists at project root
4. Prompts you to restart opencode

### Manual Install

```bash
cd memory-plugin
bun build src/memory-plugin.ts --target=bun --outfile dist/memory-plugin.js
cd ..
ln -sf ../memory-plugin/dist/memory-plugin.js .opencode/plugins/memory-plugin.js
# Restart opencode
```

---

## 🗑️ 卸载 | Uninstall

```bash
chmod +x memory-plugin/uninstall.sh
./memory-plugin/uninstall.sh
```

**Default behavior:** preserves `MEMORY.md` (your historical data) and the `memory-plugin/` directory (for reinstall). You'll be prompted before any destructive action.

**Manual cleanup:**
```bash
rm .opencode/plugins/memory-plugin.js   # remove symlink
rm -rf memory-plugin/dist                # remove compiled output
# Keep MEMORY.md — your data
```

---

## ⚙️ 配置 | Configuration

Overrides via `.opencode/config.json`:

```jsonc
{
  "memory": {
    "enabled": true,
    "retrieval": "keyword",       // "keyword" | "agent" | "both"
    "maxTokens": 3000,
    "retentionDays": 180,
    "log": true
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` (if MEMORY.md exists) | Master switch |
| `retrieval` | `"keyword"` | `"agent"` and `"both"` are reserved (unavailable without `ctx.task`) |
| `maxTokens` | `3000` | Max tokens injected into LLM input |
| `retentionDays` | `180` | Entries older than this are skipped |
| `log` | `true` | Enable file logging to `~/.local/share/opencode/log/memory-plugin.log` |

---

## ⚠️ 风险评估 | Risk Assessment

### 🔴 Data Loss
- **`[SAVE_MEMORY]` 标记可能被 LLM 误触发** → 写入非预期的决策到 `MEMORY.md`
- **`MEMORY.md` 被意外清空** → 虽然 rare，但如果插件 bug 导致 write 覆盖而非追加，会丢数据
- **回滚建议**：用 git 跟踪 `MEMORY.md`

### 🟡 Performance
- **每次 chat.message 都会做文件 I/O**（read MEMORY.md）→ 大文件（>100KB）可能影响用户体验
- **retry 机制含 100ms-3s backoff** → 极端情况下消息发送延迟可达 3s
- **建议**：MEMORY.md 控制在 50KB 以内

### 🟡 opencode 升级兼容
- 插件基于 `@opencode-ai/plugin@1.16.2` API
- `Effect Schema isStartsWith` 验证逻辑可能随版本变化（曾导致 UI 卡死）
- `experimental.text.complete` 钩子可能被弃用

---

## 🐛 已知 Bug 历史 | Known Bug History

### 2026-06-11 — 修复 ID 品牌前缀缺失（P0 严重性）
- **症状**：plugin 启用后 UI 卡住，LLM 不启动。——打开 opencode 后无限 spinning，chat 无法交互
- **根因**：`chat.message` 钩子 push TextPart 时未补全 `id`（prt_ 前缀）/ `sessionID`（ses_ 前缀）/ `messageID`（msg_ 前缀）三个品牌前缀字段。opencode 1.16.2 的 Effect Schema `isStartsWith` 验证失败 → 抛出 zod-like 验证错误 → UI 端收不到正常状态 → 卡死
- **修复**：在 push 前 patch 每个 TextPart，确保 `id.startsWith("prt_")`、`sessionID.startsWith("ses_")`、`messageID.startsWith("msg_")`
- **验证工具**：`rrxtool binary strings` 反编译验证产物字段

### 2026-06-11 — 修复 `experimental.text.complete` 回调缺字段（P1 严重性）
- **症状**：LLM 输出 `[SAVE_MEMORY]...[/SAVE_MEMORY]` 后，`experimental.text.complete` 回调的 `output.message` 缺少 `id`/`sessionID` 等字段 → plugin 尝试 write MEMORY.md 时出错
- **根因**：`experimental.text.complete` 钩子在部分版本中返回的 `output.message` 是 Partial 类型，`message.id` 和 `message.sessionID` 可能为 undefined
- **修复**：在 `handleTextComplete` 中增加 optional chaining + fallback：`message?.id ?? "msg_unknown"`，写入存储时用 fallback 值

---

## 🏗️ 架构 | Architecture

```
┌─────────────────────────────────────────────┐
│               opencode session               │
│  ┌──────────┐         ┌──────────────────┐   │
│  │  LLM      │         │  Plugin Runtime  │   │
│  │           │◄───────►│  (hooks)         │   │
│  └──────────┘         └────────┬─────────┘   │
└───────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   memory-plugin (Bun)    │
                    │                         │
                    │  chat.message:          │
                    │  ├─ keyword match?      │
                    │  ├─ read MEMORY.md      │
                    │  └─ push TextPart       │
                    │                         │
                    │  text.complete:         │
                    │  ├─ parse [SAVE_MEMORY] │
                    │  ├─ validate fields     │
                    │  └─ append MEMORY.md    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │       MEMORY.md          │
                    │  (project root)          │
                    │                         │
                    │  ## 2026-06-11          │
                    │  **类型**: 决策           │
                    │  **内容**: ...            │
                    │  **原因**: ...            │
                    └─────────────────────────┘
```

### Data Flow

1. **Read path**: User message → `chat.message` hook → keyword regex match (Chinese keywords only) → read `MEMORY.md` → filter by `retentionDays` + `[已过时]` → truncate to `maxTokens` → push as `TextPart` into messages array
2. **Write path**: LLM streaming output → `experimental.text.complete` hook → regex extract `[SAVE_MEMORY]...[/SAVE_MEMORY]` → validate date/type/content → append to `MEMORY.md`
3. **Failure path**: Both hooks have retry logic (3 attempts, 100ms–3s exponential backoff). If all retries fail, the plugin silently skips (no crash).

---

## 📄 License

MIT — see [`LICENSE`](LICENSE).
