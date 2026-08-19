/**
 * Fuzzy matching for Quick Input: case-insensitive subsequence with a
 * lightweight score — consecutive-character and basename-word-start bonuses,
 * gap penalties. Higher is better; no match is undefined. Pure functions.
 */

/**
 * Score `text` against `query` (case-insensitive subsequence).
 * @returns the match score, or undefined when query is not a subsequence.
 */
export function fuzzyScore(query: string, text: string): number | undefined {
  if (query === '') return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let score = 0
  let qi = 0
  let prevIndex = -2
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    // Consecutive matches and word starts (after a separator) score higher.
    score += ti === prevIndex + 1 ? 3 : 1
    if (ti === 0 || '/._- '.includes(t[ti - 1] ?? '') === true) score += 2
    // Gap penalty: characters skipped inside the text since the last hit.
    if (prevIndex >= 0 && ti > prevIndex + 1) score -= 1
    prevIndex = ti
    qi++
  }
  return qi === q.length ? score : undefined
}

/**
 * Rank items by fuzzy score against their text, best first.
 * @param query - the filter text.
 * @param items - candidates.
 * @param textOf - the matching text of one item.
 * @returns matched items with scores, descending by score, ties by input order.
 */
export function rankBy<T>(query: string, items: readonly T[], textOf: (item: T) => string): { item: T; score: number }[] {
  const ranked: { item: T; score: number }[] = []
  for (const item of items) {
    const score = fuzzyScore(query, textOf(item))
    if (score !== undefined) ranked.push({ item, score })
  }
  return ranked.sort((a, b) => b.score - a.score)
}
