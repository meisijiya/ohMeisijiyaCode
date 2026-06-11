# Changelog

All notable changes to **memory-plugin** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> ⚠️ **Pre-1.0 notice**: This plugin is currently in **BETA** (0.x). Minor versions may contain breaking changes. Pin a specific version in production.

---

## [0.2.0] — 2026-06-12

### Changed
- **重构为独立目录** — 插件从 `.opencode/src/` + `.opencode/plugins/` 迁出,移到项目根 `memory-plugin/` 顶层目录
- **软链分发** — `.opencode/plugins/memory-plugin.js` 改为指向 `memory-plugin/dist/memory-plugin.js` 的软链
- **opt-in 安装** — 新增 `memory-plugin/install.sh`,用户必须显式运行才会启用插件(不再自动加载)
- **干净卸载** — 新增 `memory-plugin/uninstall.sh`,默认保留 `MEMORY.md` 用户数据
- **Sisyphus prompt 集成** — `agents/sisyphus.md` 末尾追加"💾 长期记忆"章节,包含 SAVE_MEMORY 格式示例 + 中文触发关键词
- **独立文档** — 新增 `README.md`(中英双语 + BETA 警告)/ `CHANGELOG.md` / `LICENSE` / `docs/architecture.md` / `docs/test-results.md`

### Fixed
- (本次纯重构,无功能修复)

### Security
- `install.sh` 添加 `set -euo pipefail` + cleanup trap,失败时自动移除半成品软链
- `uninstall.sh` 默认保留 `MEMORY.md`,避免误删用户长期记忆

---

## [0.1.1] — 2026-06-11

### Fixed
- **P0 修复**：`chat.message` 钩子 push TextPart 时补全 `id` (`prt_` 前缀) / `sessionID` (`ses_` 前缀) / `messageID` (`msg_` 前缀) 三个品牌前缀字段,解决 opencode 1.16.2 Effect Schema `isStartsWith` 验证失败导致 UI 卡死、LLM 不启动的严重 bug
- **P1 修复**：`experimental.text.complete` 回调 `output.message` 缺字段时,使用 optional chaining + fallback (`message?.id ?? "msg_unknown"`),保证写入 MEMORY.md 不会因 undefined 报错

### Verified
- P0-P2 端到端测试通过:keyword 注入 / SAVE_MEMORY 捕获 / 180 天过期 / 流式增量
- 验证工具:`rrxtool binary strings` 反编译验证产物字段

---

## [0.1.0] — 2026-05-15

### Added
- **首次发布** — 长期记忆插件原型
- `chat.message` 钩子:关键词正则匹配(中文 14 个关键词)→ 读 `MEMORY.md` → 注入 LLM 输入
- `experimental.text.complete` 钩子:解析 LLM 输出的 `[SAVE_MEMORY]...[/SAVE_MEMORY]` 标记 → 验证 → 追加写入 `MEMORY.md`
- 配置项:`enabled` / `retrieval` / `maxTokens` (3000) / `retentionDays` (180) / `log`
- 重试机制:3 次重试,100ms–3s 指数退避
- 180 天过期过滤

### Known Limitations
- ⚠️ 仅支持中文关键词(英文 query 不触发)
- ⚠️ 无 `ctx.task` 支持,无法走 memory-router agent 模式
- ⚠️ 每次 chat.message 都做文件 I/O,大文件可能影响性能
