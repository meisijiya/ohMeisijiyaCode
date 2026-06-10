---
name: mmx-cli-usage
description: 让 Agent 通过 CLI 调用 MiniMax 全模态能力（搜索/图像/视频/语音/视觉理解）。适用于 opencode 中的所有模型——即使主模型不是多模态，也能通过 mmx CLI 获得多模态能力。
---

# MiniMax CLI (`mmx`) — Agent 使用指南

`mmx` 是 MiniMax 的官方 CLI 工具，提供统一的命令入口覆盖语言、图像、视频、语音、视觉理解与网络检索。

## 前提

```bash
npm install -g mmx-cli
mmx auth login --api-key sk-xxxxx
mmx quota  # 确认可用
```

## 常用命令（通过 bash 调用）

### 网络搜索
```bash
mmx search "<查询关键词>"
```

### 图像理解（任何模型都可调！包括非多模态模型）
```bash
mmx vision describe /path/to/image.png
mmx vision describe https://example.com/photo.jpg
```

### 文生图
```bash
mmx image "<提示词>"
mmx image "赛博朋克城市夜景, 16:9"
```

### 视频生成
```bash
mmx video generate --prompt "<提示词>"
```

### 语音合成
```bash
mmx speech synthesize --text "<文本>"
```

### 音乐生成
```bash
mmx music generate --prompt "<提示词>"
```

### 文本对话
```bash
mmx text chat --message "<问题>"
```

## Agent 使用原则

1. **用 CLI，不用 MCP**：`mmx search` 的 stdout 可控可过滤，不像 MCP 把整个工具 schema 注入上下文
2. **非多模态模型用 `mmx vision`**：即使 Sisyphus 用的是 DeepSeek 等非多模态模型，也能通过 `mmx vision describe` 理解图像
3. **结果存文件后再 read**：长输出先 `>` 存文件，再 `read` 关键行
4. **检查 `mmx quota`**：频繁调用前先确认额度
