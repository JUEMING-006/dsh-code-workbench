/**
 * Question card: the workbench AI panel's answer UI for one pending host
 * question request. The agent's ask_user_question pauses the turn until the
 * human answers; this card collects one answer per question and delivers the
 * whole batch through the carrier's respond() with the wire encoding the
 * host validates (sessionId plus an answer per question, in order: selected
 * option labels verbatim, optional custom text, empty selection for a
 * skipped question). Cancel sends the 'cancelled' error envelope. A rejected
 * receipt or transport failure re-arms the buttons.
 */

import { useState } from 'react'
import type { PendingInteraction } from '@deepseek-ai/dsh-client-runtime/client'
import { IconCommentDiscussion } from '../theme/codicons.tsx'

/** The question carrier: the pending wait narrowed on its kind. */
export type QuestionWait = Extract<PendingInteraction, { kind: 'question' }>

/** One question of the request, as the carrier payload carries it. */
type QuestionItem = QuestionWait['payload']['questions'][number]

/** Per-question draft answer. */
interface Draft {
  selected: string[]
  custom: string
  skipped: boolean
}

/** Empty draft for one question. */
function emptyDraft(): Draft {
  return { selected: [], custom: '', skipped: false }
}

/** Whether a draft counts as answered (skipped or carrying an answer). */
function completed(draft: Draft): boolean {
  return draft.skipped || draft.selected.length > 0 || draft.custom.trim() !== ''
}

/** The card: all questions of the request, answered as one batch. */
export function QuestionCard({ pending }: { pending: QuestionWait }) {
  const questions = pending.payload.questions
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(() => emptyDraft()))
  const [busy, setBusy] = useState<'answer' | 'cancel' | null>(null)
  const [error, setError] = useState<string | undefined>()

  const update = (index: number, next: Draft): void => {
    setError(undefined)
    setDrafts(current => current.map((draft, draftIndex) => draftIndex === index ? next : draft))
  }

  const choose = (index: number, label: string): void => {
    const question = questions[index] as QuestionItem
    const current = drafts[index] as Draft
    update(index, question.multiSelect === true
      ? {
        selected: current.selected.includes(label)
          ? current.selected.filter(item => item !== label)
          : [...current.selected, label],
        custom: current.custom,
        skipped: false,
      }
      : { selected: [label], custom: '', skipped: false })
  }

  const answer = (): void => {
    if (drafts.some(draft => !completed(draft))) {
      setError('Answer or skip every question before submitting.')
      return
    }
    setBusy('answer')
    setError(undefined)
    void pending.respond({
      ok: true,
      value: {
        sessionId: pending.sessionId,
        answer: {
          answers: questions.map((item, index) => {
            const draft = drafts[index] as Draft
            if (draft.skipped) return { id: item.id, selected: [] }
            const custom = draft.custom.trim()
            return {
              id: item.id,
              selected: custom === '' || item.multiSelect === true ? draft.selected : [],
              ...(custom === '' ? {} : { custom }),
            }
          }),
        },
      },
    }).then((receipt) => {
      // The host validates the batch against the exact request; a rejected
      // receipt means the answer did not settle the wait.
      if (!receipt.accepted) throw new Error(`question response rejected: ${receipt.reason}`)
    }).catch((cause: unknown) => {
      setBusy(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  const cancel = (): void => {
    setBusy('cancel')
    setError(undefined)
    void pending.respond({
      ok: false,
      error: { code: 'cancelled', message: 'the user closed this question request', details: {} },
    }).then((receipt) => {
      if (!receipt.accepted) throw new Error(`question cancellation rejected: ${receipt.reason}`)
    }).catch((cause: unknown) => {
      setBusy(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  return (
    <div className="dsh-wb-question" data-question-card>
      <div className="dsh-wb-question-strip">
        <IconCommentDiscussion size={13} />
        The agent needs your answer
      </div>
      {questions.map((question, index) => {
        const draft = drafts[index] as Draft
        return (
          <div key={question.id} className="dsh-wb-question-item" data-question-item={question.id}>
            {question.header !== undefined && <div className="dsh-wb-question-eyebrow">{question.header}</div>}
            <div className="dsh-wb-question-title">{question.question}</div>
            {question.detail !== undefined && <div className="dsh-wb-question-detail">{question.detail}</div>}
            {(question.options ?? []).map(option => (
              <button
                key={option.label}
                type="button"
                className="dsh-wb-question-option"
                aria-pressed={draft.selected.includes(option.label)}
                disabled={busy !== null}
                onClick={() => { choose(index, option.label) }}
                data-question-option={option.label}
              >
                {option.label}
              </button>
            ))}
            <input
              className="dsh-wb-question-input"
              placeholder="Other…"
              value={draft.custom}
              disabled={busy !== null}
              onChange={(event) => {
                const value = event.target.value
                update(index, question.multiSelect === true
                  ? { ...draft, custom: value, skipped: false }
                  : { selected: [], custom: value, skipped: false })
              }}
              data-question-custom
            />
            <button
              type="button"
              className="dsh-wb-question-skip"
              disabled={busy !== null}
              onClick={() => { update(index, { selected: [], custom: '', skipped: true }) }}
              data-question-skip
            >
              Skip
            </button>
          </div>
        )
      })}
      {error !== undefined && <div className="dsh-wb-error" data-question-error>{error}</div>}
      <div className="dsh-wb-question-actions">
        <button
          type="button"
          className="dsh-wb-button-secondary"
          disabled={busy !== null}
          onClick={() => { cancel() }}
          data-question-cancel
        >
          Cancel
        </button>
        <button
          type="button"
          className="dsh-wb-button"
          disabled={busy !== null}
          onClick={() => { answer() }}
          data-question-submit
        >
          Answer
        </button>
      </div>
    </div>
  )
}
