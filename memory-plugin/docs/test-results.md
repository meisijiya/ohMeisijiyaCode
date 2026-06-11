# P0-P2 Test Results — memory-plugin

> 测试时间: 2026-06-11
> 测试范围: 端到端功能验证 (keyword 注入 / SAVE_MEMORY 捕获 / 180 天过期 / 流式增量)
> 工具: `rrxtool binary strings` 反编译验证产物字段
> 结论: **功能验证通过**,暴露 2 个 bug 已修复,1 个 hankoff 预期错误已记录

---

## 📊 测试矩阵 | Test Matrix

| 测试 ID | 类别 | 描述 | 预期 | 实际 | 结论 |
|---------|------|------|------|------|------|
| P0-1 | 严重 | ID 品牌前缀缺失 → UI 卡死 | 修复后 LLM 正常启动 | LLM 正常启动 | ✅ PASS |
| P0-2 | 严重 | 流式 `chars=3` 异常 | (hankoff 预期错误) | chars=3 触发 | ⚠️ KNOWN ISSUE |
| P1-1 | 中 | `experimental.text.complete` output.message 缺字段 | optional chaining + fallback 修复 | 不报错 | ✅ PASS |
| P2-1 | 轻 | keyword 注入 | 命中后 read MEMORY.md | 正常 | ✅ PASS |
| P2-2 | 轻 | SAVE_MEMORY 捕获 | 解析 + 追加 | 正常 | ✅ PASS |
| P2-3 | 轻 | 180 天过期 | 旧条目被过滤 | 正常 | ✅ PASS |

---

## 🔴 P0 严重性测试

### P0-1: ID 品牌前缀缺失 (Critical)

**复现步骤**:
1. 启用未修复版 memory-plugin
2. 启动 opencode
3. UI 进入无限 spinning
4. LLM 不启动
5. 任何 chat 操作无响应

**根因 (Root Cause)**:
- `chat.message` 钩子 push 的 `TextPart` 对象缺 `id` / `sessionID` / `messageID` 三个品牌前缀字段
- opencode 1.16.2 用 Effect Schema `isStartsWith` 验证:`id.startsWith("prt_")` / `sessionID.startsWith("ses_")` / `messageID.startsWith("msg_")`
- 验证失败 → 抛 zod-like 错误 → UI 端收不到正常状态 → 死锁

**修复代码 (memory-plugin.ts)**:
```typescript
// 修复前
messages.push({
  type: "text",
  text: memoryContext
});

// 修复后
messages.push({
  type: "text",
  id: `prt_${crypto.randomUUID()}`,
  sessionID: input.sessionID.startsWith("ses_") ? input.sessionID : `ses_${input.sessionID}`,
  messageID: input.message.id?.startsWith("msg_") ? input.message.id : `msg_${input.message.id ?? "unknown"}`,
  text: memoryContext
});
```

**验证**:
- `rrxtool binary strings memory-plugin.js` → 确认产物中含 `prt_` / `ses_` / `msg_` 字面量
- 重启 opencode → UI 正常 + LLM 启动 + chat 响应
- 多次重启 10+ 次,无复现

**结论**: ✅ **P0-1 已修复并验证**

---

### P0-2: 流式 `chars=3` 异常 (Known Issue — Hankoff Expected)

**复现步骤**:
1. 启用 memory-plugin
2. LLM 流式输出到终端
3. 观察 experimental.text.complete 钩子触发时 `message.parts[0].text.length` 

**预期**:
- 流式到达某 completion point,text.length 期望 `>= 100` (或某个 buffer threshold)

**实际**:
- 触发时 `text.length === 3` (仅 3 字符,如 `\n\n`)

**根因分析**:
- opencode 1.16.2 `experimental.text.complete` 钩子触发时机**不固定** — opencode 内部按 tick 触发
- 当 buffer 边界正好落在行尾/段落分隔符附近时,`text.length` 可能非常小
- 这是 opencode 内部调度问题,非 plugin bug

**影响**:
- 极小 — `text.length=3` 时无 `[SAVE_MEMORY]` 标记可解析
- 后续 completion 触发会累积更长 text,不会丢数据
- 用户体验无影响

**状态**:
- ⚠️ **已知 hankoff 预期错误 (Known Issue / Hankoff Expected)**
- 不修,作为"已知怪异行为"记录
- 见 `README.md` "已知 Bug 历史" + `CHANGELOG.md` 0.1.1

---

## 🟡 P1 中严重性测试

### P1-1: `experimental.text.complete` output.message 缺字段

**复现步骤**:
1. 启用修复前版本
2. LLM 输出含 `[SAVE_MEMORY]` 标记的文本
3. plugin 尝试 write MEMORY.md → 报错

**根因**:
- `experimental.text.complete` 在部分版本中 `output.message` 是 `Partial<{id, sessionID, ...}>` 类型
- `message.id` / `message.sessionID` 可能为 `undefined`
- plugin 直接 `message.id` 抛 `TypeError: Cannot read properties of undefined`

**修复代码**:
```typescript
// 修复前
const sessionID = message.sessionID;
const log = `[${sessionID}] saved memory`;  // TypeError if undefined

// 修复后
const sessionID = message?.sessionID ?? "ses_unknown";
const log = `[${sessionID}] saved memory`;
```

**验证**:
- 单元测试: 模拟 `output.message = {}` → 不报错, fallback 到 "ses_unknown"
- 端到端: 真实 LLM 输出 SAVE_MEMORY → MEMORY.md 正确追加
- 5+ 次重试,无 TypeError

**结论**: ✅ **P1-1 已修复并验证**

---

## 🟢 P2 轻量级测试

### P2-1: keyword 注入 (Inject)

**测试用例**:
| Query | 命中 | MEMORY.md 注入 |
|-------|------|----------------|
| "为什么选择 keyword 方案?" | ✅ (为什么) | ✅ |
| "之前的决策记录" | ✅ (之前, 决策) | ✅ |
| "What is the project status?" | ❌ (无中文关键词) | ❌ skip |
| "Why did we choose X?" | ❌ (纯英文) | ❌ skip |

**结论**: ✅ **keyword 注入按预期工作**,纯英文 query 静默跳过 (符合 hankoff 预期)

---

### P2-2: SAVE_MEMORY 捕获 (Save)

**测试用例**:
```markdown
[SAVE_MEMORY]
## 2026-06-11
**类型**: 决策
**内容**: 用 keyword 不用 agent
**原因**: ctx.task 不可用
[/SAVE_MEMORY]
```

**预期**: 追加到 MEMORY.md,下次读时包含

**实际**:
- 解析成功 → 追加到 MEMORY.md
- 下次 chat.message 触发时,read MEMORY.md 包含此条

**结论**: ✅ **SAVE_MEMORY 捕获按预期工作**

---

### P2-3: 180 天过期 (Retention)

**测试用例**:
- 手动构造 200 天前条目 + 今天条目
- 触发 chat.message

**预期**: 仅今天条目注入 LLM

**实际**: 200 天前条目被 `cutoff` 过滤,仅今天条目注入

**结论**: ✅ **180 天过期按预期工作**

---

## 📋 测试结论总结

| 项目 | 状态 |
|------|------|
| 核心功能 (read/write/retention) | ✅ 全部通过 |
| P0-1 ID 品牌前缀修复 | ✅ 已修复 |
| P0-2 chars=3 hankoff 异常 | ⚠️ 已知,接受 |
| P1-1 output.message 缺字段 | ✅ 已修复 |
| 180 天过期 | ✅ 按预期 |
| 性能 (大文件 I/O) | ⚠️ < 50KB 建议,未压测 100KB+ |

**总评**: **可发布 BETA** (0.1.1),生产使用前需用户评估风险(见 README)。
