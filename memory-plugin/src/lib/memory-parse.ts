export type SectionName = "Project context" | "Rules" | "Architecture decisions" | "Discovered durable knowledge"

export const SECTION_TYPE_MAP: Record<SectionName, "context" | "rules" | "architecture" | "discovered"> = {
  "Project context": "context",
  Rules: "rules",
  "Architecture decisions": "architecture",
  "Discovered durable knowledge": "discovered",
}

export interface MemoryEntry {
  type: "context" | "rules" | "architecture" | "discovered"
  section: SectionName
  body: string
}

export interface ParsedMemory {
  sections: Record<SectionName, string>
  entries: MemoryEntry[]
}

/**
 * Parse a MEMORY.md file into 4 sections + flat entries.
 * Each section is split into per-bullet entries (lines starting with - or *).
 * Sections in unknown order still parse; missing sections default to empty.
 */
export function parseMemory(content: string): ParsedMemory {
  if (!content.trim()) throw new Error("parseMemory: empty input")
  if (!content.includes("# Project Memory")) {
    throw new Error("parseMemory: missing # Project Memory header")
  }

  const sections: Record<SectionName, string> = {
    "Project context": "",
    Rules: "",
    "Architecture decisions": "",
    "Discovered durable knowledge": "",
  }

  // Split on `## ` (section header) while preserving the section name
  const sectionRegex = /^## (.+)$/gm
  const matches: { name: string; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = sectionRegex.exec(content)) !== null) {
    matches.push({ name: m[1].trim(), start: m.index + m[0].length })
  }

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i].name
    if (!(name in sections)) continue
    const start = matches[i].start
    const end =
      i + 1 < matches.length
        ? matches[i + 1].start - ("## " + matches[i + 1].name).length
        : content.length
    sections[name as SectionName] = content.slice(start, end).trim()
  }

  // Flatten to entries: each bullet line is one entry
  const entries: MemoryEntry[] = []
  for (const [section, body] of Object.entries(sections) as [SectionName, string][]) {
    if (!body) continue
    const type = SECTION_TYPE_MAP[section]
    const bullets = body.split(/\n(?=[-*])/).map((b) => b.trim()).filter(Boolean)
    for (const b of bullets) {
      entries.push({ type, section, body: b })
    }
  }

  return { sections, entries }
}

/** Render an entry for the system_prompt injection block. */
export function renderEntry(e: MemoryEntry): string {
  return `- [${e.section}] ${e.body.replace(/^[-*]\s*/, "")}`
}
