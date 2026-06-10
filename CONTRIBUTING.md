# Contributing to myOpenCodeWithMEeee

感谢你的贡献！以下规范确保协作高效。

## 如何提交 Issue

在 [GitHub Issues](https://github.com/YOUR_USERNAME/myOpenCodeWithMEeee/issues) 提交，请包含：

- **环境信息**：操作系统、Node 版本、opencode 版本
- **复现步骤**：从零出发的最小复现路径
- **预期 vs 实际行为**：明确描述差异
- **日志 / 截图**：相关终端输出或截图附件

Feature request 请注明使用场景和期望的交互方式。

## 如何提交 Pull Request

1. **Fork 仓库** 并从 `main` 创建特性分支 `feat/xxx` 或修复分支 `fix/xxx`
2. **实现变更** — 遵循下方开发规范，确保每个 commit 原子化、可单独 review
3. **本地验证** — 运行 `bash install.sh` 确保安装无报错，手动重启 opencode 核验效果
4. **更新 CHANGELOG.md** — 在 `[Unreleased]` 段按 Added / Changed / Fixed 分类记录
5. **发起 PR** — 描述变更动机、影响范围，关联对应 Issue（如有），等待 review

## 开发规范

本项目围绕 opencode 子 agent 体系构建，所有贡献必须遵守以下原则：

### Karpathy 4 原则

1. **Think Before Coding** — 写代码前先明确假设、权衡、疑惑，不隐藏困惑
2. **Simplicity First** — 最小代码解决真实问题，不引入单次使用的抽象
3. **Surgical Changes** — 只改任务相关的行，不顺手重构、不删看似无用的代码
4. **Goal-Driven Execution** — 先把任务转化为可验证成功标准，再循环执行直到通过

详见 [`skills/karpathy-guidelines/SKILL.md`](skills/karpathy-guidelines/SKILL.md)

### OpenSpec 工作流

复杂变更必须走 OpenSpec 流程：

- **`/opsx:propose`** — 提案阶段，输出变更设计文档
- **`/opsx:explore`** — 探索现有代码约束和影响范围
- **`/opsx:apply`** — 按提案实施变更
- **`/opsx:sync`** — 同步实现与文档
- **`/opsx:archive`** — 完成后归档，形成可追溯记录

详见 [`skills/openspec-integration/SKILL.md`](skills/openspec-integration/SKILL.md)

### 子 Agent 路由约束

修改 agent 定义时，严格遵循 3 层路由表：

| Agent | 档位 | 职责 | 委派权限 |
|-------|------|------|----------|
| Sisyphus | high | 架构决策、路由委派 | 可调 Lyra + Hephaestus |
| Lyra | mid | 跨文件实现、研究 | 可调 Hephaestus |
| Hephaestus | low | CRUD、重构、测试脚手架 | 不可委派（叶子节点） |

### 提交信息规范

使用语义化前缀：`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`，保持英文小写，简洁描述动机而非罗列文件。
