# 🤖 AGENTS.md — 全局行为规范（模板）

<!--
⚠️  必读 ⚠️
本文件包含【个人行为偏好】——每个用户的系统/编码风格/语言习惯不同。
请根据你的实际情况修改下面的占位符：

  {{SYSTEM_INFO}}      → 你的操作系统（如 WSL2 Ubuntu 24.04、macOS Sonoma、Windows 11 等）
  {{CODING_STYLE_NOTE}} → 你的编码注释风格（函数级/行内/只注释复杂逻辑 等）
  {{EMOJI_USAGE_NOTE}}  → 你的 Emoji 使用习惯（喜欢/不喜欢/只在标题用 等）
-->

## 1. 语言偏好
1. 回答请用中文，无论提问用什么语言，一律使用中文回答

## 2. 系统环境
2. 我的系统为 {{SYSTEM_INFO}}

## 3. 编码风格
3. 请在生成代码时{{CODING_STYLE_NOTE}}

## 4. 表达风格
4. 请在回答时{{EMOJI_USAGE_NOTE}}

---

## 5. 长期记忆管理（可选）

> 以下规则仅在启用 memory 功能时生效（项目根目录存在 `MEMORY.md` 或 `.opencode/config.json` 配置了 `memory.enabled: true`）

### 5.1 存储规则

做出以下决策时，在回复末尾添加 `[SAVE_MEMORY]` 标记：

1. **决策**：选择了什么方案，为什么
2. **教训**：问题、根因、解决方案
3. **约束**：limitation、workaround

### 5.2 存储格式

```
[SAVE_MEMORY]
**类型**: 决策/教训/约束
**内容**: [具体决策或教训]
**原因**: [为什么]
[/SAVE_MEMORY]
```

### 5.3 何时不存储

- 常规操作（git commit、npm install）
- 临时调试
- 已有记录的重复决策

### 5.4 失效规则

存储新记忆时，检查是否与现有记忆矛盾：

1. 如果矛盾，将旧记忆标记为 `[已过时]`
2. 如果是同一主题的更新，追加而非覆盖
3. 如果是全新内容，直接追加

---

# 模板说明（删掉这一段再保存）

**安装行为**：`bash install.sh` 会在 `~/.config/opencode/AGENTS.md` 不存在时自动拷贝本模板。
**已有 AGENTS.md**：install.sh **不会覆盖**——保护你已有的个人配置。
**手动定制**：根据上方占位符替换为你自己的信息即可。
**卸载**：`bash uninstall.sh` **不会删除** AGENTS.md——它是你的个人配置，不是本项目安装的文件。

**与本项目的关系**：
- 本项目 3 个 agent 的 `.md`（sisyphus/lyra/hephaestus）不定义语言/系统/编码风格
- 这些偏好由你的 AGENTS.md 提供
- 两层互补，不冲突
