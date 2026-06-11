# ☕ Backend — Java / Spring Boot

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills for Java backend development with Spring Boot, MyBatis, and related ecosystems.

---

## Antigravity Awesome Skills — Database & Middleware

**Source**: [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills) (1,480+ skills)

| Skill | Purpose |
|-------|---------|
| **database-designer** | Schema analysis, ERD generation, index optimization, migration generation |
| **database-schema-designer** | Requirements → migration files, type definitions, seed data, RLS policies |
| **migration-architect** | Migration planning, compatibility checking, rollback generation |
| **message-queue-patterns** | MQ architecture, RabbitMQ/Kafka patterns, retry & idempotency |
| **kafka-expert** | Producer/Consumer config, partitioning, Exactly-Once semantics |

```bash
# Install database-designer for Java projects
npx skills add sickn33/antigravity-awesome-skills --skill database-designer -a opencode -g
```

---

## Jeffallan/claude-skills — Full-Stack Collection

**Source**: [`Jeffallan/claude-skills`](https://github.com/Jeffallan/claude-skills) (66 skills)

| Skill | Purpose |
|-------|---------|
| **java-springboot** | Spring Boot best practices: project structure, DI, config, Web/Service/Data layers, logging |

```bash
# Clone and symlink, or install via skills CLI if available
# GitHub: https://github.com/Jeffallan/claude-skills
```

---

## Custom MyBatis-Plus Skill Template

For projects using MyBatis-Plus, create a project-specific skill:

```bash
mkdir -p .claude/skills/mybatis-plus
# Create SKILL.md with: Mapper extends BaseMapper, Service extends IService,
# @TableName/@TableId, LambdaQueryWrapper, pagination with MybatisPlusInterceptor
```

See [jishuzhan.net article](https://jishuzhan.net/article/2062777085067866114) for a complete template.

---

## Community Collections with Java Content

| Collection | Size | Java Coverage |
|------------|------|---------------|
| [`alirezarezvani/claude-skills`](https://github.com/alirezarezvani/claude-skills) | 129 skills | database-designer, database-schema-designer, migration-architect, api-design |
| [`Jeffallan/claude-skills`](https://github.com/Jeffallan/claude-skills) | 66 skills | java-springboot, database-designer, api-design |

---

## Why These Complement Our System

Our skills are **process-centric**: karpathy (think before coding), diagnose (debug loop), tdd (test-first). These Java/Spring Boot skills provide **framework-specific domain knowledge** — the "what" to our skills' "how." They don't conflict because they operate at different abstraction layers.
