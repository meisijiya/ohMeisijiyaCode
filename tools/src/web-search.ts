/**
 * Web Search — 多 provider 回退链 + DuckDuckGo HTML 回退
 * 参考: oh-my-pi src/web/ (14 个 provider) — 此处简化为 4 + DDG
 *
 * 策略:
 *   1. 检测哪些 API key 已设置 (EXA / BRAVE / TAVILY / PERPLEXITY)
 *   2. 尝试第一个有 key 的 provider
 *   3. 如果全部失败,回退到 DuckDuckGo HTML(无需 key)
 */
import { tool } from "@opencode-ai/plugin";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const zod = tool.schema;

/**
 * 🔌 4 个商业 search provider 的元数据
 * `auth` 字段描述如何向其 API 发送 key
 */
const PROVIDERS = [
  { name: "exa", envVar: "EXA_API_KEY", endpoint: "https://api.exa.ai/search", auth: "body" },
  { name: "brave", envVar: "BRAVE_API_KEY", endpoint: "https://api.search.brave.com/res/v1/web/search", auth: "header-key" },
  { name: "tavily", envVar: "TAVILY_API_KEY", endpoint: "https://api.tavily.com/search", auth: "body" },
  { name: "perplexity", envVar: "PERPLEXITY_API_KEY", endpoint: "https://api.perplexity.ai/search", auth: "bearer" },
] as const;

/**
 * 🦆 通过 DuckDuckGo HTML 搜索(无需 API key,但限流)
 * 使用 lite.duckduckgo.com 简化版页面,提取 result-link + result-snippet
 * 返回 markdown 格式的结果
 */
async function searchDuckDuckGo(query: string, maxResults: number): Promise<string> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  try {
    const { stdout } = await execAsync(
      `curl -sL -A "Mozilla/5.0 (compatible; myOpenCodeBot/1.0)" "${url}"`,
      { maxBuffer: 5 * 1024 * 1024 },
    );
    const lines: string[] = [`# DuckDuckGo results for: ${query}\n`];
    const linkMatches = stdout.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g);
    const snippetMatches = stdout.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g);

    const links = Array.from(linkMatches).slice(0, maxResults);
    const snippets = Array.from(snippetMatches).slice(0, maxResults);

    if (links.length === 0) {
      return `# No results found for: ${query}\n(DDG HTML structure may have changed — check https://lite.duckduckgo.com)`;
    }

    for (let i = 0; i < links.length; i++) {
      const [, href, title] = links[i];
      const snippet = snippets[i]
        ? snippets[i][1].replace(/<[^>]+>/g, "").trim()
        : "(no snippet)";
      lines.push(`${i + 1}. **${title}**`);
      lines.push(`   ${href}`);
      lines.push(`   ${snippet}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch (err) {
    return `Error: DuckDuckGo search failed: ${(err as Error).message}`;
  }
}

/**
 * 🔍 通过指定 provider 搜索
 * 返回 markdown 或错误字符串
 *
 * 实现说明: 各 provider 的请求体差异很大,
 * 此处仅实现 brave 和 perplexity 两种最常见的 header 认证方式;
 * exa / tavily 留作后续(返回清晰的 not-implemented 错误信息)
 */
async function searchProvider(
  provider: typeof PROVIDERS[number],
  query: string,
  maxResults: number,
): Promise<string> {
  const apiKey = process.env[provider.envVar];
  if (!apiKey) return `Error: ${provider.envVar} not set`;

  let cmd: string;
  switch (provider.name) {
    case "brave":
      cmd = `curl -sL -H "X-Subscription-Token: ${apiKey}" "${provider.endpoint}?q=${encodeURIComponent(query)}&count=${maxResults}"`;
      break;
    case "perplexity":
      cmd = `curl -sL -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"query":"${query.replace(/"/g, '\\"')}","max_results":${maxResults}}' "${provider.endpoint}"`;
      break;
    case "tavily":
    case "exa":
    default:
      return `Error: ${provider.name} search not yet implemented (set BRAVE_API_KEY or PERPLEXITY_API_KEY instead)`;
  }

  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 5 * 1024 * 1024 });
    return `# ${provider.name} results for: ${query}\n\n\`\`\`json\n${stdout}\n\`\`\``;
  } catch (err) {
    return `Error: ${provider.name} request failed: ${(err as Error).message}`;
  }
}

export default tool({
  description:
    "Search the web using a multi-provider fallback chain. Tries Exa → Brave → Tavily → Perplexity if their API keys are set; falls back to DuckDuckGo HTML (no key needed). Use 'provider' param to pin to one.",
  args: {
    query: zod.string().describe("Search query"),
    provider: zod.enum(["auto", "exa", "brave", "tavily", "perplexity", "duckduckgo"])
      .default("auto")
      .describe("Provider (auto = use first available in chain)"),
    max_results: zod.number().default(10).describe("Max results to return"),
  },
  async execute(args) {
    const query = args.query as string;
    const provider = (args.provider as string) || "auto";
    const maxResults = (args.max_results as number) || 10;

    // 钉住特定 provider
    if (provider !== "auto") {
      if (provider === "duckduckgo") return await searchDuckDuckGo(query, maxResults);
      const p = PROVIDERS.find((x) => x.name === provider);
      if (!p) return `Error: unknown provider '${provider}'`;
      return await searchProvider(p, query, maxResults);
    }

    // 🚀 Auto: 依次尝试每个有 key 的 provider
    const tried: string[] = [];
    for (const p of PROVIDERS) {
      if (process.env[p.envVar]) {
        tried.push(p.name);
        const result = await searchProvider(p, query, maxResults);
        if (!result.startsWith("Error:")) {
          return `[Used: ${p.name}]\n${result}`;
        }
      }
    }

    // 🦆 回退到 DuckDuckGo
    tried.push("duckduckgo");
    const ddg = await searchDuckDuckGo(query, maxResults);
    const withKeys = tried.filter((t) => t !== "duckduckgo").join(", ");
    return `[Tried providers with keys: ${withKeys || "none"}; fell back to duckduckgo]\n${ddg}`;
  },
});
