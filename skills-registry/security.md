# 🔒 Security & Auth

> **使用**: `npx skills add <repo> --skill <name> -a opencode -g`

Skills for security auditing, vulnerability detection, authentication, and secret management.

---

## Trail of Bits — Security Research Skills

**Source**: [`trailofbits/skills`](https://github.com/trailofbits/skills) — Trail of Bits, a leading security research firm

Contains 20+ security-focused skills including:

| Skill | Purpose |
|-------|---------|
| **smart-contract-security** | Smart contract vulnerability auditing |
| **burp-suite-analysis** | Burp Suite project parsing and analysis |
| **semgrep-rule-creation** | Custom SAST rule writing |
| **yara-rule-writing** | Malware detection rule creation |
| **diff-based-code-review** | Differential code review for security |
| **constant-time-analysis** | Timing attack vulnerability detection |
| **property-based-testing** | Fuzzing and property testing |

```bash
# Install all trailofbits skills
npx skills add trailofbits/skills --all -a opencode -g
```

**Why it complements our system**: Our `diagnose` skill handles general debugging. Trail of Bits skills handle _security-specific_ analysis — a specialized domain our process skills don't cover.

---

## squirrelscan — Website Security Audit

**Source**: [`squirrelscan/skills`](https://github.com/squirrelscan/skills)

```bash
npx skills add squirrelscan/skills -a opencode -g
```

Purpose: 230+ audit rules across 21 categories — SEO, performance, accessibility, content, and security. Detects 96+ types of leaked secrets. Covers both security and quality assurance.

---

## stripe/ai — Payment Security Best Practices

**Source**: [`stripe/ai`](https://github.com/stripe/ai)

```bash
npx skills add stripe/ai -a opencode -g
```

Purpose: Financial payment integration best practices — Checkout Sessions API, dynamic payment method configuration, subscription billing integration.

---

## Anthropic — MCP Builder (Secure Tool Design)

**Source**: [`anthropics/skills`](https://github.com/anthropics/skills)

```bash
npx skills add anthropics/skills --skill mcp-builder -a opencode -g
```

While primarily an MCP server builder, it includes security guidance for tool design, input validation, and safe LLM-tool interaction patterns.

---

## Why These Complement Our System

Security is a specialized domain requiring deep expertise. Our general skills (karpathy, diagnose, tdd) help with process but not with security-specific knowledge like SAST rule writing or constant-time analysis. Trail of Bits and squirrelscan fill that gap.
