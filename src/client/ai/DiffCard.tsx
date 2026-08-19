/**
 * The diff apply card: renders a settled tool call's diff result view (the
 * host fs/write tool's `{ card: 'diff', diffs }` presentation) as per-file
 * ± summaries with a one-shot Accept/Reject decision. Accept writes each
 * file through the fs gateway — version-guarded only when the open tab is
 * dirty, so the user's unsaved edits cannot be clobbered — then marks the
 * tab saved; a stale-version rejection degrades to a compact conflict choice
 * (overwrite or cancel). Reject only discards the decision prompt.
 *
 * The decision is latched per card: one answer, and a failed write re-arms
 * the buttons (rolling the card back to its undecided state).
 */

import { useState } from 'react'
import { useWorkbench } from '../workbench/editor-context.ts'
import { FsGatewayError } from '../fs/client.ts'
import { IconCheck } from '../theme/codicons.tsx'
import { diffLineStats, diffPreview } from './diff-view.ts'
import type { DiffProposal } from './diff-view.ts'

/** The card's latched decision. */
type DiffDecision = 'accepted' | 'rejected'

/** The diff apply card for one settled tool call. */
export function DiffCard({ proposal }: { proposal: DiffProposal }) {
  const { fs, editor } = useWorkbench()
  const [decided, setDecided] = useState<DiffDecision | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [conflict, setConflict] = useState(false)

  /**
   * Write every diff in the proposal. `overwrite` retries unconditionally
   * after a stale-version conflict (an explicit user choice).
   */
  const accept = async (overwrite: boolean): Promise<void> => {
    setError(undefined)
    setConflict(false)
    const state = editor.getSnapshot()
    for (const diff of proposal.diffs) {
      const tab = state.groups.flatMap(group => group.tabs).find(candidate => candidate.path === diff.path)
      // Guard only a dirty tab: its unsaved edits are the one thing an
      // unconditional write could clobber; the agent's own write already
      // advanced a clean tab's disk version.
      const version = !overwrite && tab?.dirty === true ? tab.version : undefined
      try {
        const result = await fs.writeText(diff.path, diff.newText, version)
        editor.actions.markSaved(diff.path, result.version)
      } catch (cause: unknown) {
        if (!overwrite && cause instanceof FsGatewayError && cause.code === 'FS_STALE_VERSION') {
          setConflict(true)
          return
        }
        setError(cause instanceof Error ? cause.message : String(cause))
        return
      }
    }
    setDecided('accepted')
  }

  return (
    <div className="dsh-wb-diff" data-diff-card data-diff-call-id={proposal.callId}>
      <div className="dsh-wb-diff-strip">
        <IconCheck size={13} />
        {proposal.title}
      </div>
      {proposal.diffs.map(diff => {
        const stats = diffLineStats(diff.oldText, diff.newText)
        return (
          <div key={diff.path} className="dsh-wb-diff-file" data-diff-file={diff.path}>
            <div className="dsh-wb-diff-path">
              <span className="dsh-wb-diff-pathname">{diff.path}</span>
              <span className="dsh-wb-diff-stats" data-diff-stats>
                {stats.added > 0 && <span className="dsh-wb-diff-added">+{stats.added}</span>}
                {stats.removed > 0 && <span className="dsh-wb-diff-removed">−{stats.removed}</span>}
              </span>
            </div>
            <pre className="dsh-wb-diff-preview" data-diff-preview>{diffPreview(diff.newText)}</pre>
          </div>
        )
      })}
      {decided === 'accepted' && <div className="dsh-wb-diff-note" data-diff-accepted>Applied</div>}
      {decided === 'rejected' && <div className="dsh-wb-diff-note" data-diff-rejected>Changes discarded</div>}
      {error !== undefined && <div className="dsh-wb-error" data-diff-error>{error}</div>}
      {conflict && (
        <div className="dsh-wb-diff-conflict" data-diff-conflict>
          <span>The file changed on disk since your edits — applying now would overwrite them.</span>
          <div className="dsh-wb-diff-actions">
            <button
              type="button"
              className="dsh-wb-button-secondary"
              onClick={() => { setConflict(false) }}
              data-diff-conflict-cancel
            >
              Cancel
            </button>
            <button
              type="button"
              className="dsh-wb-button"
              onClick={() => { void accept(true) }}
              data-diff-conflict-overwrite
            >
              Overwrite
            </button>
          </div>
        </div>
      )}
      {decided === undefined && !conflict && (
        <div className="dsh-wb-diff-actions">
          <button
            type="button"
            className="dsh-wb-button-secondary"
            onClick={() => { setDecided('rejected') }}
            data-diff-reject
          >
            Reject
          </button>
          <button
            type="button"
            className="dsh-wb-button"
            onClick={() => { void accept(false) }}
            data-diff-accept
          >
            Accept
          </button>
        </div>
      )}
    </div>
  )
}
