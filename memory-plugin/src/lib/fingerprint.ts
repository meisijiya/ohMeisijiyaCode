export interface FileStat {
  size: number
  mtimeMs: number
}

/**
 * Compute a file's fingerprint from size and mtime.
 * Format: "${size}-${mtimeMs}"
 * Used by lazy reconcile to detect file changes without re-reading body.
 */
export function fingerprint(stat: FileStat): string {
  return `${stat.size}-${stat.mtimeMs}`
}
