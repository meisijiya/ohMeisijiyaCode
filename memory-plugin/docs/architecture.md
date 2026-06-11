# Architecture — memory-plugin

> 模块结构与数据流说明 (Module structure and data flow documentation)

---

## 📐 模块结构 | Module Structure

```
memory-plugin/
├── src/
│   └── memory-plugin.ts          # TypeScript 源 (349 行) — 唯一 source of truth
├── dist/
│   └── memory-plugin.js          # Bun 编译产物 (231 行) — opencode 实际加载
├── install.sh                     # opt-in 安装脚本(编译+建软链+trap cleanup)
├── uninstall.sh                   # 热插拔卸载脚本(默认保留 MEMORY.md)
├── docs/
│   ├── architecture.md            # 本文件
│   └── test-results.md            # P0-P2 测试报告
├── README.md                      # 中英双语 + BETA + 风险评估 + 架构图
├── CHANGELOG.md                   # Keep a Changelog 格式
└── LICENSE                        # MIT
```

**外链 (out-of-tree):**
- `.opencode/plugins/memory-plugin.js` → 软链 → `../../memory-plugin/dist/memory-plugin.js`
- `MEMORY.md` → 仍位于项目根(用户数据,**不迁移**)
- `agents/sisyphus.md` → 末尾追加"💾 长期记忆"章节,提供 SAVE_MEMORY 格式给 LLM

---

## 🔄 数据流 | Data Flow

### Read Path — chat.message 钩子 (读 MEMORY.md 注入 LLM)

```
┌────────────────────────────────────────────────────────┐
│ User sends message in opencode session                  │
│   e.g. "为什么之前选择 keyword 方案?"                    │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ opencode plugin runtime → chat.message hook            │
│   input: { sessionID, message, ... }                   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 1. loadConfig()                                         │
│    - fs.access(MEMORY.md) → enabled check               │
│    - 读 .opencode/config.json → memory config            │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 2. shouldRetrieve(message.text)                         │
│    - regex: /(决策|原因|为什么|之前|上次|记得|教训|...)/  │
│    - 仅 14 个中文关键词命中                              │
│    - 不命中 → return { skip: true, reason: no_match }  │
└──────────────────────┬─────────────────────────────────┘
                       │ hit
                       ▼
┌────────────────────────────────────────────────────────┐
│ 3. readMemory() (with retry: 3x, 100ms-3s backoff)     │
│    - fs.readFile(MEMORY.md)                              │
│    - parseEntries() → 过滤 [已过时] + 180 天外          │
│    - truncate to maxTokens (default 3000)                │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 4. push TextPart into messages array                    │
│    - patch ID: id.startsWith("prt_")                    │
│    - patch sessionID: startsWith("ses_")                │
│    - patch messageID: startsWith("msg_")                │
│    - (P0 fix — 缺前缀导致 UI 卡死)                       │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ LLM 接收 messages + TextPart (含 MEMORY.md 内容)        │
│ → 在 system context 中"看见"项目历史决策                 │
└────────────────────────────────────────────────────────┘
```

### Write Path — experimental.text.complete 钩子 (捕获 SAVE_MEMORY 追加 MEMORY.md)

```
┌────────────────────────────────────────────────────────┐
│ LLM 流式输出文本到终端                                  │
│   ...决策结论。                                          │
│   [SAVE_MEMORY]                                         │
│   ## 2026-06-12                                         │
│   **类型**: 决策                                         │
│   **内容**: 软链方案                                    │
│   **原因**: 零延迟重 build                               │
│   [/SAVE_MEMORY]                                        │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ opencode plugin runtime → experimental.text.complete    │
│   input: { output: { message: { id, sessionID, parts }}}│
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 1. parseSaveMemory(text)                                │
│    - regex: /\[SAVE_MEMORY\]([\s\S]*?)\[\/SAVE_MEMORY\]/│
│    - extract: date / type / content / reason            │
└──────────────────────┬─────────────────────────────────┘
                       │ found
                       ▼
┌────────────────────────────────────────────────────────┐
│ 2. validateEntry(entry)                                 │
│    - date format: YYYY-MM-DD                             │
│    - type ∈ {决策, 教训, 约束, 架构, 设计}               │
│    - content / reason 必填                              │
└──────────────────────┬─────────────────────────────────┘
                       │ valid
                       ▼
┌────────────────────────────────────────────────────────┐
│ 3. appendMemory(entry) (with retry: 3x backoff)         │
│    - fs.appendFile(MEMORY.md, formatted entry)          │
│    - format:                                              │
│        ## YYYY-MM-DD                                     │
│        **类型**: <type>                                  │
│        **内容**: <content>                               │
│        **原因**: <reason>                                │
│                                                       │
│    - (P1 fix — message?.id ?? "msg_unknown" fallback)  │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ MEMORY.md 持久化追加成功                                 │
│ → 下次 chat.message 钩子会读到这条新决策                  │
└────────────────────────────────────────────────────────┘
```

---

## 🧩 关键模块细节 | Key Module Details

### 1. 关键词正则 | Keyword Regex

```typescript
const KEYWORD_RE = /(决策|原因|为什么|之前|上次|记得|教训|约束|选择|方案|架构|设计|限制|规范)/;
```

- **14 个中文关键词** — 命中任一即触发 memory 注入
- **无英文支持** — 已验证,英文 query 全部 `skip: no_match`(用户接受现状,见 README 风险)
- 位置:`src/memory-plugin.ts` 中 `shouldRetrieve()` 函数

### 2. 180 天过期 | Retention Filter

```typescript
const cutoff = Date.now() - retentionDays * 86400_000;
entries = entries.filter(e => {
  if (e.date === "[已过时]") return false;
  return new Date(e.date).getTime() > cutoff;
});
```

- 默认 180 天(可在 `.opencode/config.json` 调 `retentionDays`)
- 显式 `[已过时]` 标记立即跳过

### 3. 重试机制 | Retry Logic

```typescript
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, i)));  // 100ms, 200ms, 400ms... (capped 3s)
    }
  }
  throw new Error("unreachable");
}
```

- 3 次重试,100ms → 200ms → 400ms (capped 3s)
- 失败后静默跳过,**不 crash opencode**

### 4. P0 品牌前缀修复 | P0 Brand Prefix Patch

```typescript
// 关键代码 (P0 fix)
const patched: TextPart = {
  ...part,
  id: part.id?.startsWith("prt_") ? part.id : `prt_${part.id ?? crypto.randomUUID()}`,
  sessionID: part.sessionID?.startsWith("ses_") ? part.sessionID : `ses_${part.sessionID ?? ""}`,
  messageID: part.messageID?.startsWith("msg_") ? part.messageID : `msg_${part.messageID ?? ""}`,
};
```

- opencode 1.16.2 Effect Schema 用 `isStartsWith` 验证品牌字段
- 缺前缀 → 验证失败 → UI 卡死、LLM 不启动
- 详见 README "已知 Bug 历史" 章节 + CHANGELOG [0.1.1]

---

## 🔌 外部接口 | External Interfaces

### 配置文件 | Config File (`.opencode/config.json`)

```jsonc
{
  "memory": {
    "enabled": true,         // 缺省: true (if MEMORY.md 存在)
    "retrieval": "keyword",  // "keyword" (其他值保留,未实现)
    "maxTokens": 3000,       // 注入 LLM 的最大 token 数
    "retentionDays": 180,    // 过期天数
    "log": true              // 写日志到 ~/.local/share/opencode/log/memory-plugin.log
  }
}
```

### 钩子签名 | Hook Signatures

```typescript
// chat.message — 读路径
async (input: { sessionID: string; message: Message }, output: Message[]): Promise<void>

// experimental.text.complete — 写路径
async (input: { output: { message: { id?: string; sessionID?: string; parts: Part[] }}}): Promise<void>
```

---

## ⚠️ 已知架构约束 | Known Architectural Constraints

| 约束 | 原因 | 缓解 |
|------|------|------|
| ❌ 无 `ctx.task` 支持 | opencode 1.16.2 plugin API 缺 | keyword 先稳定,future 走 agent |
| ❌ 仅中文关键词 | regex 简化,hankoff 预期错误 | 接受现状 |
| ❌ 每次 chat 都读文件 I/O | 无 in-memory cache | 控制 MEMORY.md < 50KB |
| ⚠️ `experimental.text.complete` 可能被弃用 | opencode 内部 API | monitor 升级日志 |

详见 `../README.md` 风险评估章节。
