/**
 * Diff proposal projection: narrows settled tool results that carry a diff
 * result view (the host fs/write tool emits `{ card: 'diff', diffs }`) into
 * applyable file edits. Pure functions — the DiffCard owns React state and
 * the write, this module owns extraction (and its tests).
 */

import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'

/** One host-computed file diff (ToolResultView card 'diff'). */
export interface DiffFileView {
  readonly path: string
  readonly oldText: string | null
  readonly newText: string
}

/** A settled tool result the panel renders as an applyable edit card. */
export interface DiffProposal {
  /** Stable React key (the settling call's id). */
  readonly callId: string
  readonly title: string
  readonly diffs: readonly DiffFileView[]
}

/** Line counts for the ± summary (whole-file counts, not a hunk diff). */
export interface DiffLineStats {
  readonly added: number
  readonly removed: number
}

/**
 * Extract a diff proposal from a settled tool root.
 * @param root - Tool root lifecycle value from a tool-call chat node.
 * @returns the proposal when the root settled with a non-empty diff result
 *   view; undefined for running calls, non-diff results, and empty diffs.
 */
export function diffProposalOf(root: ToolCallBlock | undefined | null): DiffProposal | undefined {
  if (!root || typeof root !== 'object' || !('kind' in root) || root.kind !== 'tool-result') return undefined
  const view = root.resultView
  if (!view || typeof view !== 'object' || view.card !== 'diff' || !Array.isArray(view.diffs) || view.diffs.length === 0) return undefined
  return {
    callId: root.callId,
    title: view.title ?? `Edit ${view.diffs.length === 1 ? '1 file' : `${view.diffs.length} files`}`,
    diffs: view.diffs,
  }
}

/**
 * File-level added/removed line counts; a null oldText is a create.
 * @param oldText - Pre-write content; null when the file was created.
 * @param newText - Post-write content.
 * @returns the newline-delimited line count of each side.
 */
export function diffLineStats(oldText: string | null, newText: string): DiffLineStats {
  return {
    added: newText.split('\n').length,
    removed: oldText === null ? 0 : oldText.split('\n').length,
  }
}

/**
 * Collapsed preview: the head of the replacement text plus an ellipsis line
 * when truncated.
 * @param newText - Post-write content to preview.
 * @param maxLines - Preview length; longer content truncates.
 * @returns the preview text.
 */
export function diffPreview(newText: string, maxLines = 8): string {
  const lines = newText.split('\n')
  const head = lines.slice(0, maxLines).join('\n')
  return lines.length > maxLines ? `${head}\n…` : head
}
