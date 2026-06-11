# 🧪 Testing — E2E / Performance / Quality

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills for end-to-end testing, browser automation, and quality assurance.

---

## browser-use — Web Browser Automation

**Source**: [`browser-use/browser-use`](https://github.com/browser-use/browser-use)

```bash
# Install via pip (it's a Python tool, not just a skill)
pip install browser-use
```

Purpose: Full browser automation for AI agents — form filling, button clicking, screenshot capture, dynamic content extraction. Ideal for E2E testing, automated crawling, web monitoring.

**Why it complements our system**: We use playwright-cli for lightweight browser tasks. browser-use provides deeper, agent-driven browser interaction for complex testing scenarios.

---

## Vercel Labs — agent-browser

**Source**: [`vercel-labs/agent-browser`](https://github.com/vercel-labs/agent-browser)

```bash
npx skills add vercel-labs/agent-browser -a opencode -g
```

Purpose: Browser automation skill enabling AI to operate browsers — form filling, clicking, screenshots, dynamic rendering content extraction.

---

## Patterns.dev — Performance Testing Concepts

**Source**: [`PatternsDev/skills`](https://github.com/PatternsDev/skills)

| Skill | Type | Purpose |
|-------|------|---------|
| **js-performance-patterns** | Performance | JavaScript performance optimization |
| **vite-bundle-optimization** | Performance | Vite bundle optimization |
| **react-render-optimization** | Performance | React render optimization patterns |

```bash
npx skills add PatternsDev/skills --skill js-performance-patterns -a opencode -g
```

---

## Anthropic — Code Review Skills

**Source**: [`anthropics/skills`](https://github.com/anthropics/skills)

| Skill | Purpose | Install |
|-------|---------|---------|
| **frontend-code-review** | Frontend code review: type safety, component structure, performance | `npx skills add anthropics/skills --skill frontend-code-review -a opencode -g` |
| **codex-review** | Automated code defect detection, CI/CD integration | `npx skills add anthropics/skills --skill codex-review -a opencode -g` |

---

## Antigravity Awesome Skills — Testing Related

**Source**: [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills)

Use `npx skills find` to discover testing skills:

```bash
npx skills find testing
npx skills find performance
npx skills find e2e
```

---

## Why These Complement Our System

Our `tdd` skill handles the **test-driven development workflow** (red-green-refactor). These testing skills handle _specific testing tools and strategies_ (browser automation, performance profiling, code review patterns). Together they form a complete testing toolkit.
