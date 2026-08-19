/**
 * Diff proposal projection tests: settled tool roots carrying a diff result
 * view extract into applyable proposals with ± line stats and a truncated
 * preview; every other root shape extracts to nothing.
 */
import { describe, expect, it } from 'vitest'
import type { RunningToolCall, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { diffLineStats, diffPreview, diffProposalOf } from './diff-view.ts'

const running: RunningToolCall = {
  callId: 'c1',
  name: 'write',
  argsRaw: '{}',
  turn: 1,
  step: 1,
  time: 0,
  callView: null,
  subCalls: [],
}

/** Settled tool-result root whose result view is caller-chosen. */
function settled(resultView: ToolResultNode['resultView']): ToolCallBlock {
  return {
    kind: 'tool-result',
    seq: 1,
    time: 0,
    callId: 'c1',
    call: { name: 'write', argsRaw: '{}' },
    callTime: 0,
    content: [],
    isError: false,
    callView: null,
    resultView,
    subCalls: [],
  }
}

const oneDiff = { path: '/w/a.ts', oldText: 'old a', newText: 'new a' }

describe('diffProposalOf', () => {
  it('rejects running calls and null views', () => {
    expect(diffProposalOf(running)).toBeUndefined()
    expect(diffProposalOf(settled(null))).toBeUndefined()
  })

  it('rejects non-diff and empty-diff result views', () => {
    expect(diffProposalOf(settled({ card: 'generic' }))).toBeUndefined()
    expect(diffProposalOf(settled({ card: 'diff', diffs: [] }))).toBeUndefined()
  })

  it('extracts the call id, title, and diffs from a diff result view', () => {
    const proposal = diffProposalOf(settled({ card: 'diff', title: 'Write /w/a.ts', diffs: [oneDiff] }))
    expect(proposal).toEqual({
      callId: 'c1',
      title: 'Write /w/a.ts',
      diffs: [oneDiff],
    })
  })

  it('defaults the title to the file count', () => {
    const single = diffProposalOf(settled({ card: 'diff', diffs: [oneDiff] }))
    expect(single?.title).toBe('Edit 1 file')
    const multi = diffProposalOf(settled({
      card: 'diff',
      diffs: [oneDiff, { path: '/w/b.ts', oldText: null, newText: 'new b' }],
    }))
    expect(multi?.title).toBe('Edit 2 files')
  })
})

describe('diffLineStats', () => {
  it('counts a create as added lines only', () => {
    expect(diffLineStats(null, 'a\nb\nc')).toEqual({ added: 3, removed: 0 })
  })

  it('counts both sides of an update', () => {
    expect(diffLineStats('old a\nold b', 'new a\nnew b\nnew c')).toEqual({ added: 3, removed: 2 })
  })
})

describe('diffPreview', () => {
  it('passes short content through unchanged', () => {
    expect(diffPreview('a\nb')).toBe('a\nb')
  })

  it('truncates long content to the line budget plus an ellipsis line', () => {
    const text = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n')
    expect(diffPreview(text)).toBe(`${Array.from({ length: 8 }, (_, index) => `line ${index + 1}`).join('\n')}\n…`)
  })

  it('honors a caller-chosen budget', () => {
    expect(diffPreview('1\n2\n3', 2)).toBe('1\n2\n…')
  })
})
