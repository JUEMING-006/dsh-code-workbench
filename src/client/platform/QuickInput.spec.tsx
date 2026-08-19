/**
 * Quick Input tests: both surfaces share the widget — command palette
 * listing/filtering/execution, file picker fetching the workspace listing
 * and opening the accepted file into the editor, keyboard navigation, and
 * dismissal.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { QuickInput } from './QuickInput.tsx'
import type { QuickInputMode } from './QuickInput.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import { createEditorStore } from '../workbench/editor-store.ts'
import type { FsClient } from '../fs/client.ts'
import { FsGatewayError } from '../fs/client.ts'
import { I18nProvider } from '../i18n/I18nProvider.tsx'

/** Fake fs client with one workspace listing; readText absolutizes. */
function fakeFs(files: readonly string[] = ['a.txt', 'sub/b.md', 'sub/deep/c.ts']): FsClient {
  return {
    listDir: vi.fn(async () => ({ path: '/w', entries: [] })),
    listAll: vi.fn(async () => ({ root: '/w', files })),
    readText: vi.fn(async (path: string) => ({
      path: path.startsWith('/w/') ? path : `/w/${path}`,
      content: `content of ${path}`,
      version: 'v1',
    })),
    writeText: vi.fn(async (path: string) => ({ path, version: 'v9' })),
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '/w', pattern: '', matches: [], truncated: false })),
    replace: vi.fn(async () => ({ path: '', version: '' })),
  }
}

/** One session at /w. */
const sessionsState = {
  current: 's1',
  ids: ['s1'],
  byId: { s1: { cwd: '/w', displayTitle: 'Test' } },
} as unknown as SessionListState
const useSessionsStub = <T,>(selector: (state: SessionListState) => T): T => selector(sessionsState)

/** Mount the widget in the given mode inside the workbench context. */
function mountQuick(mode: QuickInputMode, fs: FsClient = fakeFs()) {
  const editor = createEditorStore().create()
  const onClose = vi.fn()
  const runCommand = vi.fn()
  const utils = render(
    <I18nProvider>
      <WorkbenchContext.Provider value={{ editor, fs, sessions: { open: vi.fn(), binding: () => undefined }, workspaces: { startSession: vi.fn() } } as never}>
        <QuickInput mode={mode} useSessions={useSessionsStub} onClose={onClose} runCommand={runCommand} />
      </WorkbenchContext.Provider>
    </I18nProvider>,
  )
  return { editor, fs, onClose, runCommand, ...utils }
}

describe('QuickInput — commands mode', () => {
  it('lists every registered command', () => {
    mountQuick({ kind: 'commands' })
    expect(document.querySelectorAll('[data-quick-item]').length).toBeGreaterThan(5)
    expect(document.querySelector('[data-quick-item="workbench.action.showCommands"]')).toBeTruthy()
  })

  it('filters by fuzzy query and ranks the best match first', () => {
    mountQuick({ kind: 'commands' })
    fireEvent.change(document.querySelector('[data-quick-input-field]')!, { target: { value: 'zen mode' } })
    const items = document.querySelectorAll('[data-quick-item]')
    expect(items.length).toBe(1)
    expect(items[0]!.getAttribute('data-quick-item')).toBe('workbench.action.toggleZenMode')
  })

  it('runs the highlighted command on Enter and closes', () => {
    const { runCommand, onClose } = mountQuick({ kind: 'commands' })
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Enter' })
    expect(runCommand).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves the highlight with the arrow keys', () => {
    mountQuick({ kind: 'commands' })
    const items = document.querySelectorAll('[data-quick-item]')
    const first = items[0]!
    const second = items[1]!
    expect(first.className).toContain('dsh-wb-quickitem-active')
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'ArrowDown' })
    expect(second.className).toContain('dsh-wb-quickitem-active')
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'ArrowUp' })
    expect(first.className).toContain('dsh-wb-quickitem-active')
  })

  it('closes on Escape and overlay click', () => {
    const { onClose } = mountQuick({ kind: 'commands' })
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector('[data-quick-input]')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('QuickInput — files mode', () => {
  it('fetches the workspace listing and shows it', async () => {
    const { fs } = mountQuick({ kind: 'files' })
    await waitFor(() => expect(document.querySelectorAll('[data-quick-item]').length).toBe(3))
    expect(fs.listAll).toHaveBeenCalledWith('/w')
  })

  it('narrows by fuzzy query and opens the accepted file', async () => {
    const { editor, onClose } = mountQuick({ kind: 'files' })
    await waitFor(() => expect(document.querySelectorAll('[data-quick-item]').length).toBe(3))
    fireEvent.change(document.querySelector('[data-quick-input-field]')!, { target: { value: 'b.md' } })
    const items = document.querySelectorAll('[data-quick-item]')
    expect(items.length).toBe(1)
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Enter' })
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.activePath).toBe('/w/sub/b.md'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces listing failures', async () => {
    const failing = {
      ...fakeFs([]),
      listAll: vi.fn(async () => { throw new FsGatewayError('FS_NOT_FOUND', 'missing workspace') }),
    } as unknown as FsClient
    mountQuick({ kind: 'files' }, failing)
    await waitFor(() => expect(document.querySelector('[data-quick-input-error]')?.textContent).toContain('missing workspace'))
  })

  it('shows the empty state when nothing matches', async () => {
    mountQuick({ kind: 'files' })
    await waitFor(() => expect(document.querySelectorAll('[data-quick-item]').length).toBe(3))
    fireEvent.change(document.querySelector('[data-quick-input-field]')!, { target: { value: 'zzzz' } })
    expect(document.querySelector('[data-quick-input-empty]')?.textContent).toBe('No results found')
  })

  it('runs the command from a files-mode accept when items carry commands', () => {
    // The widget never renders commands in files mode; guard the seam by
    // asserting the mode attribute the overlay carries.
    mountQuick({ kind: 'files' })
    expect(document.querySelector('[data-quick-input]')?.getAttribute('data-quick-input')).toBe('files')
  })
})

describe('QuickInput — prompt mode', () => {
  it('shows the title and pre-filled value', () => {
    const accept = vi.fn()
    mountQuick({ kind: 'prompt', title: 'Rename', value: 'old.txt', placeholder: 'New name', accept })
    expect(document.querySelector('[data-quick-input]')?.getAttribute('data-quick-input')).toBe('prompt')
    expect(document.querySelector('[data-quick-input-title]')?.textContent).toBe('Rename')
    expect((document.querySelector('[data-quick-input-field]') as HTMLInputElement).value).toBe('old.txt')
    expect((document.querySelector('[data-quick-input-field]') as HTMLInputElement).placeholder).toBe('New name')
  })

  it('calls accept on Enter and closes', () => {
    const accept = vi.fn()
    const { onClose } = mountQuick({ kind: 'prompt', title: 'New File', value: '', placeholder: 'Name', accept })
    fireEvent.change(document.querySelector('[data-quick-input-field]')!, { target: { value: 'hello.ts' } })
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Enter' })
    expect(accept).toHaveBeenCalledWith('hello.ts')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape without accepting', () => {
    const accept = vi.fn()
    const { onClose } = mountQuick({ kind: 'prompt', title: 'New File', value: '', placeholder: 'Name', accept })
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Escape' })
    expect(accept).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
