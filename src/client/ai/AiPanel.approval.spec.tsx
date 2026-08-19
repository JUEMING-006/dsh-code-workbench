/**
 * Approval-card tests: in code mode this panel is the only approval outlet
 * (the harness ApprovalPanel rides the shadowed AppFrame), so the card must
 * surface every pending approval, answer it with the ApprovalResponsePayload
 * wire encoding, and survive answer failures.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSnapshot, PendingInteraction, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { AiPanel } from './AiPanel.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'

/** Build one pending-approval carrier fake (the real class is nominal; the
 * component reads kind/key/sessionId/payload and calls respond()). */
function approvalWait(respond = vi.fn(async () => ({ accepted: true }))): PendingInteraction {
  return {
    kind: 'approval',
    key: 'a:7',
    sessionId: 's1',
    payload: { approvalId: 'ap1', toolName: 'bash', reason: 'list files', callId: 'c1' },
    respond,
  } as unknown as PendingInteraction
}

/** One pending-question carrier fake. */
function questionWait(): PendingInteraction {
  return {
    kind: 'question',
    key: 'q:1',
    sessionId: 's1',
    payload: { questions: [{ id: 'q1', question: 'Proceed?' }] },
    respond: vi.fn(),
  } as unknown as PendingInteraction
}

/** A complete snapshot fake carrying the given pending list. */
function snapshotWith(pending: readonly PendingInteraction[]): ConversationSnapshot {
  const hasApproval = pending.some(item => item.kind === 'approval')
  return {
    chat: { order: [], nodes: new Map() },
    pending,
    runningCalls: hasApproval
      ? [{ callId: 'c1', name: 'bash', argsRaw: '{"command":"ls -la"}', turn: 1, step: 1, time: 0 }]
      : [],
    queue: [],
    running: false,
  } as unknown as ConversationSnapshot
}

/** Mount the panel with one bound session whose snapshot derives from `pending`. */
function mountPanel(pending: readonly PendingInteraction[]) {
  const snapshot = snapshotWith(pending)
  const session = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    prompt: vi.fn(async () => ({ ok: true as const })),
    command: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => ({ ok: true as const })),
  }
  const sessionsState = {
    current: 's1',
    ids: ['s1'],
    byId: { s1: { cwd: '/w', displayTitle: 'Test' } },
  } as unknown as SessionListState
  render(
    <WorkbenchContext.Provider value={{ sessions: { open: vi.fn(), binding: () => ({ session }) } } as never}>
      <AiPanel useSessions={<T,>(selector: (state: SessionListState) => T): T => selector(sessionsState)} />
    </WorkbenchContext.Provider>,
  )
  return pending
}

describe('AiPanel approval card', () => {
  it('renders the pending approval with its command line', () => {
    mountPanel([approvalWait()])
    expect(document.querySelector('[data-approval-key="a:7"]')).toBeTruthy()
    expect(screen.getByText('list files')).toBeTruthy()
    expect(screen.getByText('ls -la')).toBeTruthy()
  })

  it('answers Allow Once with the approval wire payload', async () => {
    const respond = vi.fn(async () => ({ accepted: true }))
    mountPanel([approvalWait(respond)])
    fireEvent.click(screen.getByRole('button', { name: 'Allow Once' }))
    await waitFor(() => expect(respond).toHaveBeenCalledWith({
      ok: true,
      value: { sessionId: 's1', approvalId: 'ap1', outcome: 'allowed-once' },
    }))
    // One-shot: both buttons disable until the resolved frame lands.
    expect((screen.getByRole('button', { name: 'Allow Once' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Reject' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('answers Reject with the rejected outcome', async () => {
    const respond = vi.fn(async () => ({ accepted: true }))
    mountPanel([approvalWait(respond)])
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(respond).toHaveBeenCalledWith({
      ok: true,
      value: { sessionId: 's1', approvalId: 'ap1', outcome: 'rejected' },
    }))
  })

  it('re-arms the buttons when the response carriage fails', async () => {
    const failing = vi.fn(async () => { throw new Error('transport down') })
    mountPanel([approvalWait(failing)])
    fireEvent.click(screen.getByRole('button', { name: 'Allow Once' }))
    await waitFor(() => expect(document.querySelector('[data-approval-error]')?.textContent).toContain('transport down'))
    expect((screen.getByRole('button', { name: 'Allow Once' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('renders the question card for a pending question', () => {
    mountPanel([questionWait()])
    expect(document.querySelector('[data-approval-key]')).toBeNull()
    expect(document.querySelector('[data-question-card]')).toBeTruthy()
    expect(document.querySelector('[data-chat-question]')).toBeNull()
  })

  it('renders no card when nothing is pending', () => {
    mountPanel([])
    expect(document.querySelector('[data-approval-key]')).toBeNull()
    expect(document.querySelector('[data-question-card]')).toBeNull()
  })
})
