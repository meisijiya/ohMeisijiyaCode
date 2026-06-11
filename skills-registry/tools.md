# 🛠️ Meta-Tools

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Tools for discovering, creating, and managing Agent Skills.

---

## Skill_Seekers — Generate Skills from Any Source

**Source**: [`yusufkaraaslan/Skill_Seekers`](https://github.com/yusufkaraaslan/Skill_Seekers) ⭐ 14k

The **data layer for AI systems**. Converts documentation websites, GitHub repos, PDFs, videos, and 10+ more source types into structured knowledge assets.

### Typical Workflow

```bash
# Install
pip install skill-seekers

# Create skill from documentation site
skill-seekers create https://docs.djangoproject.com/

# Package for your platform
skill-seekers package output/django --target claude
# → output/django-claude.zip (ready-to-use SKILL.md)
```

### Relation to `skills` CLI

| Tool | Role | Analogy |
|------|------|---------|
| **Skill_Seekers** | **Create** skills from raw sources | "Skill compiler" |
| **`skills` CLI** (vercel-labs) | **Install & manage** skills | "Skill package manager" |

Use Skill_Seekers when you need a skill for a library without one. Use `skills` CLI to install pre-built skills.

### Supported Sources

Documentation sites, GitHub repos, local projects, PDFs, Word/EPUB/AsciiDoc, Jupyter Notebooks, OpenAPI specs, PowerPoint, RSS feeds, YouTube videos, Confluence wikis, Notion pages, Slack/Discord exports.

### Why It Complements Our System

Our 11 global skills focus on **process** (karpathy, diagnose, tdd, etc.). Skill_Seekers lets you generate **domain knowledge** skills for specific frameworks your project uses.

---

## `skills` CLI — The Universal Installer

**Source**: [`vercel-labs/skills`](https://github.com/vercel-labs/skills) ⭐ 22k

The official CLI for installing and managing Agent Skills across 67+ agents (including OpenCode).

See [`README.md`](README.md) for full usage. Key commands:

```bash
npx skills add <repo>     # Install
npx skills list           # List installed
npx skills find [query]   # Search
npx skills remove <name>  # Remove
npx skills update         # Update
npx skills init [name]    # Create new skill template
```

---

## Antigravity Awesome Skills — Aggregated Skill Collection

**Source**: [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills) ⭐ 38.9k

A massive collection of 1,480+ skills curated for the Antigravity ecosystem. Many are compatible with OpenCode through the shared Agent Skills spec.

### Notable Skills for Our Domains

| Category | Skills |
|----------|--------|
| Database | `database-designer`, `database-schema-designer`, `migration-architect`, `postgres-best-practices`, `postgresql`, `postgresql-optimization`, `sql-optimization-patterns`, `redis`, `mysql-best-practices` |
| Messaging | `message-queue-patterns`, `kafka-expert` |
| DevOps | `ci-cd-pipeline-builder` |
| Architecture | `api-design`, `agent-designer` |

### Why It Complements Our System

This collection fills gaps our 11 process-oriented skills don't cover — database design, messaging patterns, CI/CD. Install individual skills as needed rather than the full collection.

---

## Other Notable Collections

| Collection | Skills | Focus |
|------------|--------|-------|
| [`Jeffallan/claude-skills`](https://github.com/Jeffallan/claude-skills) | 66 | Full-stack (React, Vue, Spring Boot, DevOps) |
| [`alirezarezvani/claude-skills`](https://github.com/alirezarezvani/claude-skills) | 129 | Core + POWERFUL tiers, multi-agent orchestration |
| [`anthropics/skills`](https://github.com/anthropics/skills) | ~15 | Official Anthropic skills (frontend-design, pdf, skill-creator) |
| [`openai/skills`](https://github.com/openai/skills) | ~10 | Official OpenAI Codex skills |
