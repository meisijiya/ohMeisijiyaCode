/**
 * Build an FTS5 MATCH expression from a free-form user query.
 *
 * FTS5's MATCH grammar has its own operators and special characters
 * (`"`, `(`, `)`, `*`, `:`, `^`, `-`, `.`, `{`, `}`). Passing a raw user
 * string with any of these crashes the parser. Wrapping each token as a
 * phrase and joining avoids the crash; OR-join keeps recall high.
 *
 * \p{L} includes CJK letters. Punctuation becomes separator. Both query
 * and indexed body see only alphanumeric/underscore runs.
 *
 * OR (not AND): AND-join required EVERY query word to appear in a document,
 * so a single descriptive word the user added that wasn't in the stored
 * text zeroed the whole query even when 6/7 tokens matched. Empirically
 * AND returned 0 results for nearly all multi-word queries. OR lets BM25
 * rank by how many / how rare the matched tokens are; the caller applies
 * a score floor to drop common-word-only noise.
 *
 * Returns null when no usable tokens are extracted. Callers should treat
 * that as "empty query, no results" without sending the query to SQL.
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? []
  if (tokens.length === 0) return null
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`)
  return quoted.join(" OR ")
}
