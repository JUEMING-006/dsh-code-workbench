/**
 * Fuzzy matcher tests: subsequence acceptance, scoring order (consecutive
 * and word-start bonuses beat scattered matches), and ranking stability.
 */
import { describe, expect, it } from 'vitest'
import { fuzzyScore, rankBy } from './fuzzy.ts'

describe('fuzzyScore', () => {
  it('accepts case-insensitive subsequences and rejects non-subsequences', () => {
    expect(fuzzyScore('abc', 'xaybzc')).toBeDefined()
    expect(fuzzyScore('ABC', 'abc')).toBeDefined()
    expect(fuzzyScore('acb', 'abc')).toBeUndefined()
    expect(fuzzyScore('abc', 'ab')).toBeUndefined()
  })

  it('scores the empty query as a zero match', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('scores consecutive and word-start matches higher', () => {
    const tight = fuzzyScore('abc', 'abc')!
    const scattered = fuzzyScore('abc', 'a-x-b-x-c')!
    const wordStart = fuzzyScore('f', 'src/foo.ts')!
    const midWord = fuzzyScore('o', 'foo')!
    expect(tight).toBeGreaterThan(scattered)
    expect(wordStart).toBeGreaterThan(midWord)
  })
})

describe('rankBy', () => {
  it('orders by descending score and keeps unmatched items out', () => {
    const ranked = rankBy('ba', [
      { name: 'banana.txt' },
      { name: 'basket.md' },
      { name: 'zzz.log' },
    ], item => item.name)
    expect(ranked.map(entry => entry.item.name)).not.toContain('zzz.log')
    const first = ranked[0]
    const second = ranked[1]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.score).toBeGreaterThanOrEqual(second!.score)
  })

  it('preserves input order among equal scores', () => {
    const ranked = rankBy('a', [{ n: 'xa' }, { n: 'ya' }, { n: 'ax' }], item => item.n)
    expect(ranked.map(entry => entry.item.n)).toEqual(['ax', 'xa', 'ya'])
  })

  it('scores word starts above mid-word hits', () => {
    const wordStart = fuzzyScore('f', 'src/foo.ts')
    const midWord = fuzzyScore('o', 'foo')
    expect(wordStart).toBeDefined()
    expect(midWord).toBeDefined()
    expect(wordStart!).toBeGreaterThan(midWord!)
  })
})
