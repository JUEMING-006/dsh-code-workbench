/**
 * Question card tests: the pending-question answer form's wire behavior.
 * The carrier is a plain stand-in (the runtime mints the real wait); each
 * test asserts the exact client-response encoding the host validates.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuestionCard } from './QuestionCard.tsx'
import type { QuestionWait } from './QuestionCard.tsx'

/** One single-select question with two options. */
const singleQuestion = {
  id: 'q1',
  header: 'Checkpoint',
  question: 'Approve the plan?',
  detail: 'Plan: rewrite the store.',
  options: [{ label: 'Approve' }, { label: 'Decline' }],
}

/** A multi-select question. */
const multiQuestion = {
  id: 'q2',
  question: 'Which targets?',
  options: [{ label: 'Alpha' }, { label: 'Beta' }],
  multiSelect: true,
}

/** Carrier stand-in whose respond resolves to an accepted receipt. */
function makePending(questions: QuestionWait['payload']['questions'], respond = vi.fn(async () => ({ accepted: true }))) {
  const pending = {
    kind: 'question',
    key: 'q:1',
    sessionId: 's1',
    payload: { questions },
    respond,
  } as unknown as QuestionWait
  render(<QuestionCard pending={pending} />)
  return respond
}

describe('QuestionCard', () => {
  it('renders the question header, title, detail, options, and controls', () => {
    makePending([singleQuestion])
    expect(document.querySelector('[data-question-card]')).toBeTruthy()
    expect(screen.getByText('Checkpoint')).toBeTruthy()
    expect(screen.getByText('Approve the plan?')).toBeTruthy()
    expect(screen.getByText('Plan: rewrite the store.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy()
    expect(document.querySelector('[data-question-custom]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy()
  })

  it('answers a single-select option with its label verbatim', () => {
    const respond = makePending([singleQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByRole('button', { name: 'Approve' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q1', selected: ['Approve'] }] },
      },
    })
  })

  it('replaces the selection with custom text on a single-select question', () => {
    const respond = makePending([singleQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.change(document.querySelector('[data-question-custom]')!, { target: { value: '  my way  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q1', selected: [], custom: 'my way' }] },
      },
    })
  })

  it('keeps multi-select labels alongside custom text', () => {
    const respond = makePending([multiQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    fireEvent.change(document.querySelector('[data-question-custom]')!, { target: { value: 'Gamma' } })
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q2', selected: ['Alpha', 'Beta'], custom: 'Gamma' }] },
      },
    })
  })

  it('answers a skipped question with an empty selection', () => {
    const respond = makePending([singleQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q1', selected: [] }] },
      },
    })
  })

  it('covers every question of a multi-question batch, in order', () => {
    const respond = makePending([singleQuestion, multiQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q1', selected: ['Decline'] }, { id: 'q2', selected: [] }] },
      },
    })
  })

  it('blocks an incomplete batch and shows the validation error', () => {
    const respond = makePending([singleQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(respond).not.toHaveBeenCalled()
    expect(document.querySelector('[data-question-error]')?.textContent).toContain('Answer or skip every question')
  })

  it('cancels with the cancelled error envelope', () => {
    const respond = makePending([singleQuestion])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(respond).toHaveBeenLastCalledWith({
      ok: false,
      error: { code: 'cancelled', message: 'the user closed this question request', details: {} },
    })
  })

  it('re-arms the controls when the host rejects the response', async () => {
    const respond = vi.fn(async () => ({ accepted: false, reason: 'bad-response' }))
    makePending([singleQuestion], respond)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    await screen.findByText('question response rejected: bad-response')
    expect(screen.getByRole('button', { name: 'Answer' }).getAttribute('disabled')).toBeNull()
  })

  it('re-arms the controls when the carrier rejects the send', async () => {
    const respond = vi.fn(async () => { throw new Error('carrier down') })
    makePending([singleQuestion], respond)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    await screen.findByText('carrier down')
    expect(screen.getByRole('button', { name: 'Answer' }).getAttribute('disabled')).toBeNull()
  })
})
