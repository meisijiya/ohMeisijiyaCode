# 🧭 Skills Registry — Domain-Skill Recommendations

> **Guidance-only.** We don't ship project-level skill auto-installation.
> Users install domain skills themselves via `npx skills` CLI (`vercel-labs/skills`).
> This directory is a **curated recommendation index** — not an automation script.

## Quick Start

```bash
# 1. List all skills in a repo
npx skills add <owner/repo> --list -a opencode

# 2. Install a specific skill (project scope)
npx skills add <owner/repo> --skill <name> -a opencode

# 3. Install globally (recommended — same location as our 11 global skills)
npx skills add <owner/repo> --skill <name> -a opencode -g -y
```

### Key `skills` CLI Options for OpenCode

| Flag | Purpose |
|------|---------|
| `-a opencode` | Target OpenCode agent |
| `-g` / `--global` | Install to `~/.config/opencode/skills/` |
| `-s` / `--skill <name>` | Install specific skill(s) |
| `-l` / `--list` | List available skills in a repo |
| `-y` / `--yes` | Skip confirmations (headless) |
| `--all` | Install all skills to all agents |

## Three Major Scenarios

| Scenario | Recommended Files | Key Repos |
|----------|-------------------|-----------|
| **Frontend dev** | `frontend-react.md`, `frontend-vue.md`, `frontend-design.md` | `vercel-labs/agent-skills`, `PatternsDev/skills`, `anthropics/skills` |
| **Backend dev** | `backend-java.md`, `backend-python.md`, `database.md` | `antigravity-awesome-skills`, `supabase/agent-skills`, `Jeffallan/claude-skills` |
| **Tooling & Ops** | `devops.md`, `security.md`, `testing.md` | `trailofbits/skills`, `squirrelscan/skills`, `browser-use/browser-use` |

## Domain Index

| File | Domain | Focus |
|------|--------|-------|
| [`tools.md`](tools.md) | Meta-tools | Skill_Seekers, `skills` CLI, antigravity-awesome-skills |
| [`frontend-react.md`](frontend-react.md) | React / Next.js | Hooks, composition, RSC, Patterns.dev |
| [`frontend-vue.md`](frontend-vue.md) | Vue / Nuxt | Composition API, performance, SSR |
| [`frontend-design.md`](frontend-design.md) | UI/UX design | Design guidelines, frontend-design, web-design-guidelines |
| [`backend-java.md`](backend-java.md) | Java / Spring Boot | Spring Boot, MyBatis, JPA |
| [`backend-python.md`](backend-python.md) | Python / FastAPI / Django | FastAPI, Django, testing |
| [`database.md`](database.md) | SQL & NoSQL | PostgreSQL, MySQL, Redis, MongoDB |
| [`devops.md`](devops.md) | Docker / K8s / CI-CD | Container, orchestration, pipeline |
| [`security.md`](security.md) | Security & auth | Audit, SAST, secret detection |
| [`testing.md`](testing.md) | E2E / performance | Playwright, browser automation, load testing |

## Philosophy: Why We Don't Automate

1. **No overlap with our 11 global skills** — our skills are process/workflow oriented (karpathy, diagnose, tdd, etc.). Domain skills are technology-specific (React, Java, Docker). They complement, not conflict.
2. **`skills` CLI is already excellent** — `npx skills add owner/repo --skill name -a opencode -g -y` is a single command. Bundling would duplicate functionality.
3. **User choice matters** — not every project needs Java skills. Let the developer decide.
4. **No touching install.sh / uninstall.sh / orchestrator** — these remain purely for our core agent system.

## Reference Blogs

- [程序员鱼皮 — 40 Agent Skills 精选资源](https://www.cnblogs.com/yupi/p/19608327)
- [鱼皮 AI 导航 Skills 专区](https://ai.codefather.cn/skills)
- [技术站 — Java 技术栈 Skills 全景指南](https://jishuzhan.net/article/2062777085067866114)
- [vercel-labs/skills — CLI README](https://github.com/vercel-labs/skills)
- [yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers)
