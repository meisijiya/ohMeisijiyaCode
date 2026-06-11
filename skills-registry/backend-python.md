# 🐍 Backend — Python / FastAPI / Django

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills for Python backend development with FastAPI, Django, and related ecosystems.

---

## Skill_Seekers — Generate Framework Skills from Docs

**Source**: [`yusufkaraaslan/Skill_Seekers`](https://github.com/yusufkaraaslan/Skill_Seekers)

The most practical approach for Python frameworks — generate skills directly from official docs:

```bash
# Generate FastAPI skill
pip install skill-seekers
skill-seekers create https://fastapi.tiangolo.com/
skill-seekers package output/fastapi --target claude

# Generate Django skill
skill-seekers create https://docs.djangoproject.com/
skill-seekers package output/django --target claude

# Generate Flask skill
skill-seekers create https://flask.palletsprojects.com/
skill-seekers package output/flask --target claude
```

**Why this approach**: Python frameworks update frequently. Skill_Seekers generates up-to-date skills from live docs, avoiding stale training data.

---

## Antigravity Awesome Skills — Python-Related

**Source**: [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills)

| Skill | Purpose |
|-------|---------|
| **api-design** | API design patterns applicable to FastAPI/DRF |
| **database-designer** | Schema design for Django ORM / SQLAlchemy |
| **ci-cd-pipeline-builder** | Python CI/CD with pytest, coverage |

---

## Community Collections with Python Content

| Collection | Notes |
|------------|-------|
| [`Jeffallan/claude-skills`](https://github.com/Jeffallan/claude-skills) | 66 skills including Python backend patterns |
| [`alirezarezvani/claude-skills`](https://github.com/alirezarezvani/claude-skills) | 129 skills covering Python ecosystem |
| [`PatternsDev/skills`](https://github.com/PatternsDev/skills) | 58 skills including JS patterns transferable to Python |

---

## Why These Complement Our System

Our 11 global skills handle _process_ (plan, implement, test, debug). These Python skills provide _framework conventions_ (Django's "batteries-included" patterns, FastAPI's dependency injection, SQLAlchemy ORM patterns). They teach the AI what _correct Pythonic code_ looks like for specific frameworks.
