# memory-plugin TODO

> Future improvements for **project-level, single .md file, lightweight** long-term memory.
> Last updated: 2026-06-12 (after P0-P2 tests + refactor to independent dir).

---

## 🎯 Product Scope (锚定)

**In scope**:
- ✅ 项目级（per-project）的长期记忆
- ✅ **单 .md 文件**（MEMORY.md，git-friendly，零数据库）
- ✅ 轻量化（0 外部运行时依赖，单文件 TS，Bun 编译）
- ✅ opt-in 热插拔（install/uninstall 独立脚本）
- ✅ keyword 触发注入（[SAVE_MEMORY] 标记捕获）

**Out of scope (Non-Goals)**:
- ❌ 跨项目 / 全局级记忆（项目级是核心）
- ❌ 多 MEMORY 文件（违反"单 .md"）
- ❌ 向量检索 / embedding（违反"轻量化"）
- ❌ sub-agent 语义判断（opencode 1.16.2 plugin API 限制 + 复杂度爆炸）
- ❌ npm publish（beta 阶段过早工程化）
- ❌ 跨语言运行时（只支持 Bun）
- ❌ UI 集成（违反"轻量化"，CLI 日志足够）

---

## 🔴 P0 — Known Bugs (核心 bug 必修)

### T1. P0-1 流式 chunk `chars=3` 异常

**Symptom**: plugin 日志 `memory saved chars=3`，但实际 `[SAVE_MEMORY]...[/SAVE_MEMORY]` 标记远 > 3 字符。

**Root cause** (hypothesis): `experimental.text.complete` 钩子被**流式多次触发**，非贪婪正则 `[\s\S]*?` 在某个 chunk 内只匹配 `...`。

**Fix options**:
- A) 改用流式 buffer 累积（但 plugin API 无 state）
- B) 接受现状（plugin 仍清理标记 + 写入不完整，**可能导致 MEMORY.md 被污染**）
- C) 在 plugin 端**不解析**标记，改在用户消息中识别 `[/SAVE_MEMORY]` 闭合标记

**Recommendation**: C — 风险最低。

### T2. 纯英文 query 0% 触发

**Symptom**: "Why did we choose this approach?" 不触发注入。

**Root cause**: `KEYWORD_RE` 只含中文关键词。

**Fix options**:
- A) **加英文关键词**（推荐）—— 一行 regex 改动
  ```js
  const KEYWORD_RE = /决策|原因|为什么|之前|上次|记得|教训|约束|选择|方案|架构|设计|限制|规范|decision|reason|why|previous|last|remember|lesson|constraint|chose|plan|architecture|design|limit|standard/i
  ```
- B) 在 README 明确"纯英文不支持"（降级为 known limitation）

**Recommendation**: A — keyword 增强是轻量级改动。

### T3. agent 模式静默 fallback 警告

**Symptom**: 用户设 `retrieval: "agent"` 但实际降级到 keyword，无明显提示。

**Fix**: 在 `plugin loaded` 日志里加 summary 列出实际生效的 retrieval mode + fallback reason（1-2 行代码改动）。

---

## 🟠 P1 — 轻量化改进（与核心定位一致）

### T4. MEMORY.md 自动备份

**Why**: 单 .md 文件 + 误删 = 数据丢失。简单 `cp` 解决。

**Plan**:
- 每次 `appendToMemory` 写入前 cp MEMORY.md 到 `memory-plugin/backup/MEMORY-YYYY-MM-DD-HHMMSS.md`
- 保留最近 30 个备份（自动清理旧的）
- 提供 `memory-plugin/restore.sh <timestamp>`

**Cost**: 30 行 bash。**In scope** ✅

### T5. 单元测试覆盖

**Why**: 纯函数（parseEntries / readMemory / appendToMemory / shouldRetrieveMemory）适合 Bun:test。无外部依赖，0 网络/DB。

**Plan**:
- `memory-plugin/src/memory-plugin.test.ts` 用 Bun:test
- 覆盖边界：空文件 / 单条 / 多条 / 含过时标记 / 过期日期
- Coverage target: 80%+

**Cost**: 200-300 行 TS。**In scope** ✅（无 CI 也能本地跑）

### T6. 调试模式

**Why**: 用户排查"为什么没触发注入"困难。

**Plan**:
- 环境变量 `MEMORY_PLUGIN_DEBUG=1` 启用详细日志
- 每次注入时打印：匹配关键词 / 注入字符数 / 跳过原因
- 默认 OFF（避免污染日志）

**Cost**: 5-10 行代码。**In scope** ✅

### T7. 配置文档完善

**Why**: 当前 `.opencode/config.json` 的 `memory` 字段没 schema 文档。

**Plan**: README 加一段：
```json
{
  "memory": {
    "enabled": true,
    "retrieval": "keyword" | "agent" | "both",
    "maxTokens": 3000,
    "retentionDays": 180
  }
}
```

**Cost**: 纯文档。**In scope** ✅

---

## 🟡 P2 — 性能 / 体验

### T8. keyword 缓存

**Why**: 每次 query 重新 parse MEMORY.md + 过滤 + 拼接，浪费 CPU。

**Plan**:
- parsed entries 缓存在内存
- `appendToMemory` 写入时失效缓存
- 用 mtime 检测外部修改

**Trade-off**: 写时需同步失效。

**Cost**: 20-30 行代码。**In scope** ✅

### T9. LLM 响应里展示"记忆注入"提示

**Why**: 用户不知道 plugin 触发了，希望有可见反馈。

**Plan**:
- 简单做法：在 plugin log 里写 INFO 级行（已经做了）
- 进阶做法：用 `tui.toast.show` 钩子弹 toast（**违反轻量化，谨慎**）

**Recommendation**: 仅做 log，不做 toast。

---

## 🚫 Explicit Non-Goals（划清边界）

> 这些是**已考虑但明确不做**的扩展点。原因：偏离"轻量化 + 单 .md + 项目级"核心定位。

| 项 | 拒绝原因 | 替代方案 |
|---|---|---|
| ~~memory-router agent 接入~~ | 引入 LLM 调用 = 复杂 + 成本 + latency | keyword 增强（T2）+ 文档引导用户精确提问 |
| ~~memory-compactor agent~~ | 引入 sub-agent = 复杂度爆炸 | 180 天自动过期（plugin 内置）足够 |
| ~~CI/CD + GitHub Actions~~ | beta 阶段过早工程化 | 本地 `bun test` 即可 |
| ~~npm publish~~ | 单文件 plugin 无分发需求 | 软链 opt-in 安装足够 |
| ~~导入/导出工具~~ | 单 .md = `cp MEMORY.md` 即可 | 用 git 备份 |
| ~~UI 集成 / toast 提示~~ | 违反"轻量化"，增加耦合 | 已有 plugin log |
| ~~hybrid 检索（keyword + embedding）~~ | 引入 sqlite-vss / lance = 依赖爆炸 | keyword 增强（T2）覆盖 80%+ 场景 |
| ~~跨会话/全局级记忆~~ | 项目级是核心 | 想要全局级用 git 同步 MEMORY.md |
| ~~plugin 热重载~~ | 复杂度高，opencode 端无支持 | 用户重启 opencode 即可（< 5s） |
| ~~plugin sandbox~~ | 单 .md 风险低 | 用户自己审 plugin 源码 |
| ~~多 MEMORY 文件（分主题）~~ | 违反"单 .md"硬约束 | 在 .md 内用 `## 主题: xxx` 分节 |

---

## 📊 范围对比

| 维度 | 之前 TODO | 重构后 TODO |
|---|---|---|
| 总项数 | 18 | **9**（-50%）|
| P0 | 3 | 3 |
| P1 | 5 | 4（去 T4 memory-router + T5 compactor） |
| P2 | 6 | 2（去 T9/T14/T15）|
| P3（远期）| 4 | 0（全部划为 Non-Goals） |
| 定位偏离 | 11 项 | **0** |

---

## 🚀 建议 Next Step

按价值/工作量比（**仅限 In scope**）:

1. **T1 + T2 + T3**（P0 全做）—— 1-2 小时
2. **T5**（单元测试）—— 2-3 小时
3. **T4**（自动备份）—— 30 分钟
4. **T6 + T7 + T8**（轻量改进）—— 1-2 小时

短期 1 周做完 P0 + 全部 P1，beta 即可稳定。

---

**Last reviewed**: 2026-06-12 (slim scope revision)  
**Next review trigger**: 任何 P0 修复后，或 30 天内未实施 P1
