/**
 * Web Search — proxies to MiniMax /v1/coding_plan/search API
 *
 * Reuses the MiniMax API key+host already configured in
 * ~/.config/opencode/opencode.json's mcp.MiniMax.environment block.
 *
 * API: POST {MINIMAX_API_HOST}/v1/coding_plan/search
 *      Headers: Authorization: Bearer <key>, MM-API-Source: Minimax-MCP
 *      Body: { "q": <query> }
 *
 * Response shape:
 *   { "organic": [{title, link, snippet, date}],
 *     "related_searches": [{query}],
 *     "base_resp": {status_code, status_msg} }
 */
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { readFile } from "fs/promises";

const DEFAULT_HOST = "https://api.minimaxi.com";

/**
 * Read MiniMax credentials from opencode.json (so the tool auto-discovers
 * the same key/host the MiniMax MCP uses, no duplicate env config).
 */
async function loadMiniMaxCreds(): Promise<{ key: string; host: string } | null> {
  const candidates = [
    `${process.env.HOME}/.config/opencode/opencode.json`,
    `${process.env.HOME}/.config/opencode/oh-my-openagent.json`,
  ];
  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf-8");
      const config = JSON.parse(raw);
      const mcp = config?.mcp?.MiniMax;
      if (mcp?.environment?.MINIMAX_API_KEY) {
        return {
          key: mcp.environment.MINIMAX_API_KEY,
          host: mcp.environment.MINIMAX_API_HOST || DEFAULT_HOST,
        };
      }
    } catch {
      // try next candidate
    }
  }
  // Fall back to env vars
  if (process.env.MINIMAX_API_KEY) {
    return {
      key: process.env.MINIMAX_API_KEY,
      host: process.env.MINIMAX_API_HOST || DEFAULT_HOST,
    };
  }
  return null;
}

/**
 * Format MiniMax search response as a readable markdown list.
 */
function formatResults(data: any, query: string): string {
  const lines: string[] = [];
  const statusCode = data?.base_resp?.status_code ?? 0;
  const statusMsg = data?.base_resp?.status_msg ?? "";
  if (statusCode !== 0) {
    return `Error: MiniMax API error ${statusCode}: ${statusMsg}`;
  }
  const organic = data?.organic ?? [];
  const related = data?.related_searches ?? [];

  lines.push(`# Web search: ${query}\n`);
  if (organic.length === 0) {
    lines.push("_No results._\n");
  } else {
    organic.forEach((r: any, i: number) => {
      lines.push(`${i + 1}. **${r.title ?? "(no title)"}**`);
      if (r.date) lines.push(`   _${r.date}_`);
      lines.push(`   ${r.link ?? ""}`);
      if (r.snippet) lines.push(`   ${r.snippet}`);
      lines.push("");
    });
  }
  if (related.length > 0) {
    lines.push("## Related searches");
    for (const r of related.slice(0, 5)) {
      lines.push(`- ${r.query}`);
    }
  }
  return lines.join("\n");
}

export default tool({
  description: "Search the web via MiniMax API (auto-discovers credentials from opencode.json's mcp.MiniMax block). Use for real-time information, current events, or external research. Returns up to 10 organic results + related queries.",
  args: {
    query: z.string().describe("Search query (3-5 keywords works best; include date for time-sensitive topics)"),
    max_results: z.number().default(10).describe("Max results to return (default 10)"),
  },
  async execute(args) {
    const query = args.query as string;
    const maxResults = (args.max_results as number) || 10;

    const creds = await loadMiniMaxCreds();
    if (!creds) {
      return `Error: MiniMax credentials not found. Either:
1. Configure the MiniMax MCP in ~/.config/opencode/opencode.json, or
2. Set MINIMAX_API_KEY and MINIMAX_API_HOST environment variables`;
    }

    try {
      const res = await fetch(`${creds.host}/v1/coding_plan/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.key}`,
          "MM-API-Source": "Minimax-MCP",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, max_results: maxResults }),
      });
      if (!res.ok) {
        return `Error: MiniMax API returned ${res.status}: ${res.statusText}`;
      }
      const data = await res.json();
      return formatResults(data, query);
    } catch (err) {
      return `Error: web search failed: ${(err as Error).message}`;
    }
  },
});
