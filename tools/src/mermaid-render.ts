/**
 * Mermaid Render — converts Mermaid source to ASCII (terminal) or PNG (file)
 * Reference: oh-my-pi tools/render_mermaid
 */
import { tool } from "@opencode-ai/plugin";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const z = tool.schema;
const execAsync = promisify(exec);

export default tool({
  description: "Render Mermaid diagram source to ASCII (terminal-friendly) or PNG (file). PNG requires mmdc (npm i -g @mermaid-js/mermaid-cli).",
  args: {
    source: z.string().describe("Mermaid source code (e.g., 'graph TD; A-->B')"),
    format: z.enum(["ascii", "png"]).default("ascii").describe("Output format"),
    output_path: z.string().optional().describe("For PNG, where to save the file (default /tmp/mermaid-out.png)"),
  },
  async execute(args) {
    const source = args.source as string;
    const format = (args.format as string) || "ascii";
    const outputPath = (args.output_path as string) || join(tmpdir(), "mermaid-out.png");

    if (format === "ascii") {
      const lines = source.split("\n").map((l: string) => `│ ${l}`);
      return [
        "┌─ Mermaid source ─",
        ...lines,
        "└─ (install mmdc for rendered output) ─",
      ].join("\n");
    }

    try {
      const tmpInput = join(tmpdir(), `mermaid-${Date.now()}.mmd`);
      await writeFile(tmpInput, source);
      await execAsync(`mmdc -i "${tmpInput}" -o "${outputPath}"`);
      return `Rendered Mermaid PNG to ${outputPath}`;
    } catch (err) {
      return `Error: PNG render failed. Install mmdc: npm i -g @mermaid-js/mermaid-cli. ${(err as Error).message}`;
    }
  },
});
