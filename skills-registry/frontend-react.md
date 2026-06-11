# ⚛️ Frontend — React / Next.js

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills to level up React and Next.js development with AI assistance.

---

## Vercel Labs — React & Next.js Best Practices

**Source**: [`vercel-labs/agent-skills`](https://github.com/vercel-labs/agent-skills)

| Skill | Install Command | Purpose |
|-------|----------------|---------|
| **react-best-practices** (⭐ 148.9k installs) | `npx skills add vercel-labs/agent-skills --skill react-best-practices -a opencode -g` | React Hooks, composition patterns, performance optimization |
| **composition-patterns** (⭐ 48.4k installs) | `npx skills add vercel-labs/agent-skills --skill composition-patterns -a opencode -g` | Compound components, extensible composition |
| **next-best-practices** | `npx skills add vercel-labs/next-skills --skill next-best-practices -a opencode -g` | Next.js App Router, Server Components, data fetching |
| **react-native-skills** | `npx skills add vercel-labs/agent-skills --skill react-native-skills -a opencode -g` | React Native performance & architecture |

**Why it complements our system**: Our skills handle *process* (plan, implement, test). These teach AI _React-specific conventions_ — no overlap.

---

## Patterns.dev — 18 React Design & Rendering Skills

**Source**: [`PatternsDev/skills`](https://github.com/PatternsDev/skills) — 58 skills total

| Skill | Type | Purpose |
|-------|------|---------|
| **hooks-pattern** | Design | Reusable stateful logic across components |
| **hoc-pattern** | Design | Cross-cutting concerns via props injection |
| **compound-pattern** | Design | Multi-component single-task composition |
| **render-props-pattern** | Design | JSX element sharing via props |
| **presentational-container-pattern** | Design | View/logic separation |
| **ai-ui-patterns** | Design | AI-driven interfaces (chat, assistants) |
| **react-2026** | Design | Modern stack: Vitest, Vite SSR, React Compiler |
| **react-composition-2026** | Design | React 19 composition: slots, polymorphism |
| **client-side-rendering** | Rendering | CSR patterns |
| **server-side-rendering** | Rendering | SSR patterns |
| **static-rendering** | Rendering | SSG |
| **streaming-ssr** | Rendering | Streaming SSR |
| **react-server-components** | Rendering | RSC patterns |
| **react-render-optimization** | Performance | Vite/SPA render optimization |
| **react-data-fetching** | Performance | TanStack Query, Suspense, React.cache |

```bash
# Install a specific Pattern
npx skills add PatternsDev/skills --skill hooks-pattern -a opencode -g
npx skills add PatternsDev/skills --skill react-server-components -a opencode -g
```

**Why it complements our system**: Patterns.dev is _the_ canonical React design patterns reference. Our skills don't teach framework specifics.

---

## Anthropic — Frontend Design

**Source**: [`anthropics/skills`](https://github.com/anthropics/skills)

| Skill | Install Command | Purpose |
|-------|----------------|---------|
| **frontend-design** | `npx skills add anthropics/skills --skill frontend-design -a opencode -g` | Production-grade UI with distinctive visual identity |

---

## Expo — React Native

**Source**: [`expo/skills`](https://github.com/expo/skills)

```bash
npx skills add expo/skills --skill expo -a opencode -g
```

Purpose: React Native mobile development with Expo, covering native UI, data fetching, deployment, CI/CD.
