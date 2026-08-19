/**
 * Active-file awareness tests: the fact record, the log-only session append
 * (agent live vs absent), and the prompt section provider.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  ACTIVE_FILE_SECTION, getActiveFile, installActiveFileSection, noteActiveFile,
} from './active-file.ts'

/** Context double: a live agent with a spying session, or none at all. */
function ctxWith(agent: unknown): Context {
  return {
    agents: { get: vi.fn(() => agent) },
    systemPrompt: { section: vi.fn(() => () => {}) },
    logger: { warn: vi.fn() },
  } as unknown as Context
}

describe('noteActiveFile', () => {
  it('records the fact without a session', () => {
    const ctx = ctxWith(undefined)
    noteActiveFile(ctx, '/w/a.ts', undefined)
    expect(getActiveFile()).toEqual({ path: '/w/a.ts', sessionId: undefined })
  })

  it('appends a log-only editor/active event when the agent is live', () => {
    const append = vi.fn()
    const agent = { session: { append } }
    const ctx = ctxWith(agent)
    noteActiveFile(ctx, '/w/a.ts', SessionId('s1'))
    expect(append).toHaveBeenCalledWith('editor/active', { path: '/w/a.ts' })
  })

  it('skips the append when the session has no live agent', () => {
    const ctx = ctxWith(undefined)
    noteActiveFile(ctx, '/w/a.ts', SessionId('s1'))
    expect(getActiveFile()).toMatchObject({ sessionId: 's1' })
  })

  it('swallows append failures loudly in the log', () => {
    const warn = vi.fn()
    const agent = { session: { append: () => { throw new Error('log full') } } }
    const ctx = { agents: { get: () => agent }, logger: { warn } } as unknown as Context
    noteActiveFile(ctx, '/w/a.ts', SessionId('s1'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('editor/active'))
  })
})

describe('installActiveFileSection', () => {
  it('registers a dynamic section that names the active file', () => {
    const section = vi.fn((_section: { name: string; order: number; text: () => string }) => () => {})
    const ctx = { systemPrompt: { section } } as unknown as Context
    const dispose = installActiveFileSection(ctx)
    expect(section).toHaveBeenCalledWith(expect.objectContaining({ name: ACTIVE_FILE_SECTION, order: 60 }))
    const registered = section.mock.calls[0]![0] as unknown as { text: () => string }
    noteActiveFile(ctxWith(undefined), '/w/a.ts', undefined)
    expect(registered.text()).toBe('The user is currently viewing: /w/a.ts')
    // A missing fact renders nothing.
    noteActiveFile(ctxWith(undefined), '/w/b.ts', undefined)
    expect(registered.text()).not.toBe('')
    dispose()
  })
})
