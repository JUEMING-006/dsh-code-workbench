/**
 * Diff card apply-flow tests: the card renders a diff proposal as per-file
 * ± summaries with a collapsed preview; Accept writes each file through the
 * fs gateway — version-guarded only when the open tab is dirty — and marks
 * the tab saved; Reject never writes; a stale-version write degrades to the
 * compact conflict choice (overwrite or cancel), and any other failure
 * re-arms the one-shot decision.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FsClient } from '../fs/client.ts'
import { FsGatewayError } from '../fs/client.ts'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import { createEditorStore } from '../workbench/editor-store.ts'
import { DiffCard } from './DiffCard.tsx'
import type { DiffProposal } from './diff-view.ts'

const proposal: DiffProposal = {
  callId: 'c1',
  title: 'Write /w/a.ts',
  diffs: [
    { path: '/w/a.ts', oldText: 'old a\nold a', newText: 'new a\nnew a\nnew a' },
    { path: '/w/b.ts', oldText: null, newText: 'new b' },
  ],
}

/** Fake gateway client whose only write path is caller-chosen. */
function makeFs(writeText: FsClient['writeText']): FsClient {
  return {
    listDir: vi.fn(async () => ({ path: '/w', entries: [] })),
    listAll: vi.fn(async () => ({ root: '/w', files: [] })),
    readText: vi.fn(async () => { throw new FsGatewayError('FS_NOT_FOUND', 'missing') }),
    writeText,
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '/w', pattern: '', matches: [], truncated: false })),
    replace: vi.fn(async () => ({ path: '', version: '' })),
  }
}

const sessions = { open: vi.fn(), binding: vi.fn(() => undefined) }
const workspaces = { startSession: vi.fn() }
const fsOps = { mkdir: vi.fn(), rename: vi.fn(), remove: vi.fn() }

/** Mount the card over a real editor store; `dirty` marks the open tab edited. */
function mountCard(writeText: FsClient['writeText'], openTab: boolean, dirty = false) {
  const editor = createEditorStore().create()
  if (openTab) {
    editor.actions.openTab({ path: '/w/a.ts', content: 'user content', version: 'v1', dirty: false })
    if (dirty) editor.actions.setContent('/w/a.ts', 'user edits')
  }
  render(
    <WorkbenchContext.Provider value={{ editor, fs: makeFs(writeText), fsOps, sessions, workspaces }}>
      <DiffCard proposal={proposal} />
    </WorkbenchContext.Provider>,
  )
  return editor
}

/** A write that always succeeds and reports the new provider version. */
function okWrite(): FsClient['writeText'] {
  return vi.fn(async (path: string) => ({ path, version: 'v2' }))
}

describe('DiffCard', () => {
  it('renders the proposal: per-file paths, ± stats, and a collapsed preview', () => {
    mountCard(okWrite(), false)
    expect(document.querySelector('[data-diff-card][data-diff-call-id="c1"]')).toBeTruthy()
    expect(document.querySelector('[data-diff-file="/w/a.ts"]')).toBeTruthy()
    expect(document.querySelector('[data-diff-file="/w/b.ts"]')).toBeTruthy()
    const updated = document.querySelector('[data-diff-file="/w/a.ts"] [data-diff-stats]')?.textContent
    expect(updated).toContain('+3')
    expect(updated).toContain('−2')
    // A create shows added lines only.
    const created = document.querySelector('[data-diff-file="/w/b.ts"] [data-diff-stats]')?.textContent
    expect(created).toBe('+1')
    expect(document.querySelector('[data-diff-file="/w/a.ts"] [data-diff-preview]')?.textContent).toBe('new a\nnew a\nnew a')
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })

  it('Accept writes every diff — version-guarded for the dirty tab — and marks it saved', async () => {
    const writeText = okWrite()
    const editor = mountCard(writeText, true, true)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(writeText).toHaveBeenNthCalledWith(1, '/w/a.ts', 'new a\nnew a\nnew a', 'v1')
    expect(writeText).toHaveBeenNthCalledWith(2, '/w/b.ts', 'new b', undefined)
    expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v2', dirty: false })
    expect(document.querySelector('[data-diff-accepted]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('Accept writes unconditionally when the open tab is clean', async () => {
    const writeText = okWrite()
    mountCard(writeText, true, false)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(writeText).toHaveBeenNthCalledWith(1, '/w/a.ts', 'new a\nnew a\nnew a', undefined)
  })

  it('Reject discards the decision without writing', () => {
    const writeText = okWrite()
    mountCard(writeText, true, true)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(writeText).not.toHaveBeenCalled()
    expect(document.querySelector('[data-diff-rejected]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('a stale-version write degrades to the conflict choice, and Overwrite retries unconditionally', async () => {
    const writeText = vi.fn<FsClient['writeText']>()
      .mockRejectedValueOnce(new FsGatewayError('FS_STALE_VERSION', 'file changed on disk'))
      .mockResolvedValueOnce({ path: '/w/a.ts', version: 'v2' })
      .mockResolvedValueOnce({ path: '/w/b.ts', version: 'v2' })
    const editor = mountCard(writeText, true, true)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(document.querySelector('[data-diff-conflict]')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }))
    await waitFor(() => expect(document.querySelector('[data-diff-accepted]')).toBeTruthy())
    expect(writeText).toHaveBeenNthCalledWith(2, '/w/a.ts', 'new a\nnew a\nnew a', undefined)
    expect(writeText).toHaveBeenNthCalledWith(3, '/w/b.ts', 'new b', undefined)
    expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v2', dirty: false })
  })

  it('Cancel from the conflict choice re-arms the decision without a retry write', async () => {
    const writeText = vi.fn<FsClient['writeText']>()
      .mockRejectedValue(new FsGatewayError('FS_STALE_VERSION', 'file changed on disk'))
    mountCard(writeText, true, true)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(document.querySelector('[data-diff-conflict]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-diff-conflict]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('a non-stale write failure surfaces the error and re-arms the decision', async () => {
    const writeText = vi.fn<FsClient['writeText']>()
      .mockRejectedValue(new FsGatewayError('FS_DENIED', 'policy denied the write'))
    const editor = mountCard(writeText, true, true)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(document.querySelector('[data-diff-error]')?.textContent).toBe('policy denied the write'))
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(writeText).toHaveBeenCalledTimes(1)
    // The failed file was not marked saved.
    expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v1', dirty: true })
  })
})
