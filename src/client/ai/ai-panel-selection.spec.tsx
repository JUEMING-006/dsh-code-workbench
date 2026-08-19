/**
 * Selection-attachment tests: the AI panel composer attaches the shell's
 * current editor selection as a context part ahead of the user message, and
 * removes it again from the chip.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSnapshot, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { AiPanel } from './AiPanel.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import type { EditorSelection } from '../workbench/editor-context.ts'

/** Mount the panel with one bound session and a caller-chosen selection. */
function mountPanel(selection: EditorSelection | undefined, snapshot?: ConversationSnapshot) {
  const prompt = vi.fn(async () => ({ ok: true as const }))
  const bound = snapshot ?? {
    chat: { order: [], nodes: new Map() },
    pending: [],
    runningCalls: [],
    queue: [],
    running: false,
  } as unknown as ConversationSnapshot
  const session = {
    subscribe: () => () => {},
    getSnapshot: () => bound,
    prompt,
    command: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => ({ ok: true as const })),
  }
  const sessionsState = {
    current: 's1',
    ids: ['s1'],
    byId: { s1: { cwd: '/w', displayTitle: 'Test' } },
  } as unknown as SessionListState
  render(
    <WorkbenchContext.Provider value={{
      sessions: { open: vi.fn(), binding: () => ({ session }) },
      workspaces: { startSession: vi.fn() },
      selectionGet: () => selection,
    } as never}>
      <AiPanel useSessions={<T,>(selector: (state: SessionListState) => T): T => selector(sessionsState)} />
    </WorkbenchContext.Provider>,
  )
  return prompt
}

const selection: EditorSelection = { path: '/w/a.ts', line: 3, col: 5, text: 'const x = 1' }

describe('AiPanel selection attachment', () => {
  it('attaches the current selection and sends it as a context part', () => {
    const prompt = mountPanel(selection)
    expect((screen.getByRole('button', { name: 'Selection' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Selection' }))
    expect(document.querySelector('[data-chat-attach]')?.textContent).toContain('/w/a.ts:3:5')
    fireEvent.change(document.querySelector('[data-chat-input]')!, { target: { value: 'explain this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(prompt).toHaveBeenCalledWith([
      { type: 'text', text: 'Selection from /w/a.ts (line 3, column 5):\n```\nconst x = 1\n```' },
      { type: 'text', text: 'explain this' },
    ], 'queue')
    // The attachment is consumed by the send.
    expect(document.querySelector('[data-chat-attach]')).toBeNull()
  })

  it('sends a bare message when no selection is available', () => {
    const prompt = mountPanel(undefined)
    expect((screen.getByRole('button', { name: 'Selection' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(document.querySelector('[data-chat-input]')!, { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(prompt).toHaveBeenCalledWith([{ type: 'text', text: 'hi' }], 'queue')
  })

  it('removes the attached selection from its chip', () => {
    const prompt = mountPanel(selection)
    fireEvent.click(screen.getByRole('button', { name: 'Selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove attached selection' }))
    expect(document.querySelector('[data-chat-attach]')).toBeNull()
    fireEvent.change(document.querySelector('[data-chat-input]')!, { target: { value: 'bare' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(prompt).toHaveBeenCalledWith([{ type: 'text', text: 'bare' }], 'queue')
  })

  it('renders a diff apply card for a settled tool call carrying a diff result view', () => {
    const root = {
      kind: 'tool-result',
      seq: 1,
      time: 0,
      callId: 'c9',
      call: { name: 'write', argsRaw: '{}' },
      callTime: 0,
      content: [],
      isError: false,
      callView: null,
      resultView: {
        card: 'diff',
        title: 'Write /w/a.ts',
        diffs: [{ path: '/w/a.ts', oldText: 'old', newText: 'new' }],
      },
      subCalls: [],
    }
    const snapshot = {
      chat: {
        order: ['k1'],
        nodes: new Map([['k1', { kind: 'tool-call', seq: 1, time: 0, data: { root } }]]),
      },
      pending: [],
      runningCalls: [],
      queue: [],
      running: false,
    } as unknown as ConversationSnapshot
    mountPanel(undefined, snapshot)
    expect(document.querySelector('[data-diff-card][data-diff-call-id="c9"]')).toBeTruthy()
    expect(document.querySelector('[data-diff-file="/w/a.ts"]')).toBeTruthy()
    // The tool row is replaced by the card, not rendered alongside it.
    expect(document.querySelector('[data-chat-kind="tool"]')).toBeNull()
  })
})
