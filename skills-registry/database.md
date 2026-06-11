# 🗄️ Database — SQL & NoSQL

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills for database design, optimization, and management.

---

## Supabase — PostgreSQL Best Practices

**Source**: [`supabase/agent-skills`](https://github.com/supabase/agent-skills)

```bash
npx skills add supabase/agent-skills --skill postgres-best-practices -a opencode -g
```

Purpose: Comprehensive PostgreSQL guidance — query optimization, index design, schema patterns, Row Level Security. Teaches AI to write production-grade PostgreSQL code.

---

## Antigravity Awesome Skills — Database Collection

**Source**: [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills)

| Skill | Purpose | Install |
|-------|---------|---------|
| **database-designer** | Schema analysis, ERD generation, index optimization | `npx skills add sickn33/antigravity-awesome-skills --skill database-designer -a opencode -g` |
| **database-schema-designer** | Requirements → migrations, types, seed data | `npx skills add sickn33/antigravity-awesome-skills --skill database-schema-designer -a opencode -g` |
| **migration-architect** | Migration planning, compatibility, rollback | `npx skills add sickn33/antigravity-awesome-skills --skill migration-architect -a opencode -g` |
| **postgresql** | Types, indexes, constraints, advanced features | `npx skills add sickn33/antigravity-awesome-skills --skill postgresql -a opencode -g` |
| **postgresql-optimization** | Query tuning, index strategy, production management | `npx skills add sickn33/antigravity-awesome-skills --skill postgresql-optimization -a opencode -g` |
| **sql-optimization-patterns** | Slow query optimization, execution plan analysis | `npx skills add sickn33/antigravity-awesome-skills --skill sql-optimization-patterns -a opencode -g` |
| **mysql-best-practices** | MySQL design, indexing, transaction isolation | `npx skills add sickn33/antigravity-awesome-skills --skill mysql-best-practices -a opencode -g` |
| **redis** | Data structures, caching strategies, connection management | `npx skills add sickn33/antigravity-awesome-skills --skill redis -a opencode -g` |

---

## Redis Official Skill

**Source**: Redis Official (see [redis.io blog](https://redis.io))

The Redis team publishes guidelines for correct Redis usage covering:

- Data structure selection (Hashes vs JSON vs Sorted Sets vs Vector Sets)
- Anti-pattern prevention (no KEYS loop, no unbounded key growth)
- Production defaults (connection pooling, pipeline, cluster compatibility)

Install via: follow Redis Labs' `npx skills` distribution or the antigravity `redis` skill above.

---

## Why These Complement Our System

Our skills handle _process_ (how to plan, implement, test). These database skills handle _data domain knowledge_ — schema design, query optimization, indexing strategy. An AI needs both to build production-grade applications. No overlap.
