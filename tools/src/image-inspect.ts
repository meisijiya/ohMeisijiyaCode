/**
 * Image Inspect — proxies to MiniMax /v1/coding_plan/vlm (Vision Language Model)
 *
 * Reuses the MiniMax credentials from opencode.json's mcp.MiniMax block
 * (same as web-search tool — no duplicate config).
 *
 * API: POST {host}/v1/coding_plan/vlm
 *      Body: { "prompt": <prompt>, "image_url": <base64-data-URL> }
 *
 * image_source accepts:
 *   1. HTTP/HTTPS URL → download + base64-encode
 *   2. data: URL (already base64) → pass through
 *   3. Local file path → read + base64-encode (JPEG/PNG/WebP)
 *
 * Strip leading @ if present.
 */
import { tool } from "@opencode-ai/plugin";
import { readFile } from "fs/promises";
import { extname } from "path";

const z = tool.schema;

const DEFAULT_HOST = "https://api.minimaxi.com";
const SUPPORTED_FORMATS = ["jpeg", "jpg", "png", "webp"] as const;

/**
 * 从 opencode.json 自动发现 MiniMax 凭证（与 web-search 共用同一套配置）。
 */
async function loadMiniMaxCreds(): Promise<{ key: string; host: string } | null> {
  const configPath = `${process.env.HOME}/.config/opencode/opencode.json`;
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    const mcp = config?.mcp?.MiniMax;
    if (mcp?.environment?.MINIMAX_API_KEY) {
      return {
        key: mcp.environment.MINIMAX_API_KEY,
        host: mcp.environment.MINIMAX_API_HOST || DEFAULT_HOST,
      };
    }
  } catch {
    // opencode.json 缺失或不可读
  }
  if (process.env.MINIMAX_API_KEY) {
    return {
      key: process.env.MINIMAX_API_KEY,
      host: process.env.MINIMAX_API_HOST || DEFAULT_HOST,
    };
  }
  return null;
}

/**
 * 根据 HTTP Content-Type 头推断图片格式。
 */
function detectFormatFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpeg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpeg";
}

/**
 * 根据本地文件扩展名推断图片格式。
 */
function detectFormatFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase().replace(".", "");
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if ((SUPPORTED_FORMATS as readonly string[]).includes(ext)) return ext;
  return "jpeg";
}

/**
 * 将多种形式的 image_source 统一转换为 base64 data URL。
 * 对应 minimax_mcp/utils.py:process_image_url 的逻辑。
 */
async function imageSourceToDataUrl(source: string): Promise<string> {
  // 去掉可能的前导 @
  if (source.startsWith("@")) source = source.slice(1);

  // 已经是 data: URL，直接透传
  if (source.startsWith("data:")) return source;

  // HTTP/HTTPS URL —— 下载后 base64 编码
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to download image: HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "";
    const format = detectFormatFromContentType(contentType);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:image/${format};base64,${base64}`;
  }

  // 本地文件路径 —— 读取后 base64 编码
  const buffer = await readFile(source);
  const format = detectFormatFromPath(source);
  const base64 = buffer.toString("base64");
  return `data:image/${format};base64,${base64}`;
}

export default tool({
  description: "Analyze an image using MiniMax's Vision Language Model. Accepts HTTP URLs, data: URLs, or local file paths (JPEG/PNG/WebP). Returns a text description based on the prompt.",
  args: {
    prompt: z.string().describe("What to analyze or extract from the image"),
    image_source: z.string().describe("Image source: HTTP URL, data: URL, or local file path. Strip leading @ if present."),
  },
  async execute(args) {
    const prompt = args.prompt as string;
    const imageSource = args.image_source as string;

    if (!prompt) return "Error: prompt is required";
    if (!imageSource) return "Error: image_source is required";

    const creds = await loadMiniMaxCreds();
    if (!creds) {
      return `Error: MiniMax credentials not found. Either:
1. Configure the MiniMax MCP in ~/.config/opencode/opencode.json, or
2. Set MINIMAX_API_KEY and MINIMAX_API_HOST environment variables`;
    }

    let imageUrl: string;
    try {
      imageUrl = await imageSourceToDataUrl(imageSource);
    } catch (err) {
      return `Error: failed to process image: ${(err as Error).message}`;
    }

    try {
      const res = await fetch(`${creds.host}/v1/coding_plan/vlm`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.key}`,
          "MM-API-Source": "Minimax-MCP",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, image_url: imageUrl }),
      });
      if (!res.ok) {
        return `Error: MiniMax VLM API returned ${res.status}: ${res.statusText}`;
      }
      const data = await res.json();
      const statusCode = data?.base_resp?.status_code ?? 0;
      if (statusCode !== 0) {
        return `Error: MiniMax VLM API error ${statusCode}: ${data?.base_resp?.status_msg}`;
      }
      return data?.content || "(no analysis returned)";
    } catch (err) {
      return `Error: VLM request failed: ${(err as Error).message}`;
    }
  },
});
