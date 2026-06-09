/**
 * Hashline Edit tool — replaces default edit with line#CID anchor system
 * Reference: oh-my-pi patch/edit + omO src/tools/hashline-edit
 */
import { tool } from "@opencode-ai/plugin";
import { readFile, writeFile } from "fs/promises";
import { tagLines, validateTag } from "./hashline-tag";

const z = tool.schema;

const HashlineEditSchema = z.object({
  path: z.string().describe("File path to edit"),
  op: z.enum(["replace", "append", "prepend"]).describe("Edit operation"),
  pos: z.string().regex(/^\d+#..$/).optional().describe("Start anchor (LINE#CID format)"),
  end: z.string().regex(/^\d+#..$/).optional().describe("End anchor (LINE#CID format)"),
  lines: z.array(z.string()).describe("New lines to write"),
  delete: z.boolean().optional().describe("If true, delete the file (replace op only)"),
});

export default tool({
  description: "Edit a file using LINE#CID hashline anchors. If anchors are stale (file changed), edit is rejected before corruption. Replaces opencode's default edit tool for higher accuracy on weak models.",
  args: {
    path: HashlineEditSchema.shape.path,
    op: HashlineEditSchema.shape.op,
    pos: HashlineEditSchema.shape.pos.optional(),
    end: HashlineEditSchema.shape.end.optional(),
    lines: HashlineEditSchema.shape.lines,
    delete: HashlineEditSchema.shape.delete.optional(),
  },
  async execute(args, context) {
    const { path, op, pos, end, lines, delete: shouldDelete } = args;

    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (err) {
      return `Error: cannot read ${path}: ${(err as Error).message}`;
    }

    if (shouldDelete && op === "replace") {
      await writeFile(path, "");
      return `Deleted ${path}`;
    }

    const originalLines = content.split("\n");

    if (pos) {
      const posLine = originalLines[parseInt(pos.split("#")[0], 10) - 1];
      if (!posLine) return `Error: pos anchor ${pos} is out of range`;
      if (!validateTag(`${pos.split("#")[0]}#${pos.split("#")[1]}| ${posLine}`, content)) {
        return `Error: pos anchor ${pos} is stale — file has changed. Re-read the file and try again.`;
      }
    }

    if (end) {
      const endLine = originalLines[parseInt(end.split("#")[0], 10) - 1];
      if (!endLine) return `Error: end anchor ${end} is out of range`;
      if (!validateTag(`${end.split("#")[0]}#${end.split("#")[1]}| ${endLine}`, content)) {
        return `Error: end anchor ${end} is stale — file has changed. Re-read the file and try again.`;
      }
    }

    let newLines: string[];

    if (op === "replace") {
      if (!pos) return `Error: replace requires pos anchor`;
      const startIdx = parseInt(pos.split("#")[0], 10) - 1;
      const endIdx = end ? parseInt(end.split("#")[0], 10) - 1 : startIdx;
      newLines = [
        ...originalLines.slice(0, startIdx),
        ...lines,
        ...originalLines.slice(endIdx + 1),
      ];
    } else if (op === "append") {
      if (pos) {
        const startIdx = parseInt(pos.split("#")[0], 10) - 1;
        newLines = [
          ...originalLines.slice(0, startIdx + 1),
          ...lines,
          ...originalLines.slice(startIdx + 1),
        ];
      } else {
        newLines = [...originalLines, ...lines];
      }
    } else {
      if (pos) {
        const startIdx = parseInt(pos.split("#")[0], 10) - 1;
        newLines = [
          ...originalLines.slice(0, startIdx),
          ...lines,
          ...originalLines.slice(startIdx),
        ];
      } else {
        newLines = [...lines, ...originalLines];
      }
    }

    await writeFile(path, newLines.join("\n"));
    return `Edited ${path}: ${op} at ${pos || "BOF"}${end ? `-${end}` : ""}, ${lines.length} line(s) written`;
  },
});
