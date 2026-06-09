/**
 * Hashline tagging — assigns LINE#CID format to each line
 * Reference: oh-my-pi patch/edit/hashline + omO hashline-edit/hash-computation
 */

export const CID_CHARSET = "ZPMQVRWSNKTXJBYH";

function computeCid(line: string): string {
  // FNV-1a hash for simplicity (Rust original uses FNV)
  let hash = 0x811c9dc5;
  for (let i = 0; i < line.length; i++) {
    hash ^= line.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const byte1 = (hash >>> 4) & 0x0f;
  const byte2 = hash & 0x0f;
  return CID_CHARSET[byte1] + CID_CHARSET[byte2];
}

export function tagLines(content: string): string[] {
  const lines = content.split("\n");
  return lines.map((line, idx) => {
    const lineNum = idx + 1;
    const cid = computeCid(line);
    return `${lineNum}#${cid}| ${line}`;
  });
}

export function validateTag(tagged: string, content: string): boolean {
  const lines = content.split("\n");
  const match = tagged.match(/^(\d+)#(..)\|/);
  if (!match) return false;
  const lineNum = parseInt(match[1], 10);
  const expectedCid = match[2];
  if (lineNum < 1 || lineNum > lines.length) return false;
  const actualCid = computeCid(lines[lineNum - 1]);
  return expectedCid === actualCid;
}
