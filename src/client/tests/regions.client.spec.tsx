/**
 * Region render tests: the file explorer (lazy tree), the sidebar content
 * dispatcher (activity routing + workspace cwd), and the editor area (tabs,
 * edit, version-guarded save). All fs traffic goes through a fake client; the
 * editor store is a real engine instance.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FsClient, FsOpsClient } from '../fs/client.ts'
import { FsGatewayError } from '../fs/client.ts'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { TextareaEditorSurface } from '../editor/EditorSurface.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import { createEditorStore } from '../workbench/editor-store.ts'
import { DEFAULT_GEOMETRY } from '../workbench/geometry.ts'
import type { AiLocation, WorkbenchGeometryState } from '../workbench/geometry.ts'
import { AuxBarContent } from '../workbench/parts/AuxBarContent.tsx'
import { EditorArea } from '../workbench/parts/EditorArea.tsx'
import { FilesView } from '../workbench/parts/FilesView.tsx'
import { SidebarContent } from '../workbench/parts/SidebarContent.tsx'
import { I18nProvider } from '../i18n/I18nProvider.tsx'

/** Surface stand-in every test mount provides (deterministic, no monaco). */
const editorSurface = TextareaEditorSurface

/** Sessions/workspaces stand-ins (no host service in tests). */
const sessions = { open: vi.fn(), binding: vi.fn(() => undefined) }
const workspaces = { startSession: vi.fn() }

/** Structural-ops stand-in (host fs-ops gateway is tested host-side). */
const fsOps: FsOpsClient = {
  mkdir: vi.fn(async (root: string, path: string) => ({ path })),
  rename: vi.fn(async (root: string, path: string, newPath: string) => ({ path, newPath })),
  remove: vi.fn(async (root: string, path: string) => ({ path })),
}

/** Fake gateway client over an in-memory tree. */
function fakeFs(): FsClient {
  return {
    listDir: vi.fn(async (path: string) => {
      if (path === '/w') {
        return { path, entries: [{ name: 'a.txt', type: 'file' as const }, { name: 'sub', type: 'directory' as const }] }
      }
      if (path === '/w/sub') return { path, entries: [{ name: 'b.txt', type: 'file' as const }] }
      throw new FsGatewayError('FS_NOT_FOUND', `missing: ${path}`)
    }),
    listAll: vi.fn(async (path: string) => ({ root: path, files: ['a.txt', 'sub/b.txt'] })),
    readText: vi.fn(async (path: string) => {
      if (path.endsWith('b.txt')) throw new FsGatewayError('FS_NOT_TEXT', 'not a text file')
      return { path, content: `content of ${path}`, version: 'v1' }
    }),
    writeText: vi.fn(async (path: string) => ({ path, version: 'v9' })),
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '/w', pattern: '', matches: [], truncated: false })),
    replace: vi.fn(async () => ({ path: '', version: '' })),
  }
}

/** Session-list selector stub: one current session at /w. */
const sessionsState = {
  current: 's1',
  ids: ['s1'],
  byId: { s1: { cwd: '/w', displayTitle: 'Test Session' } },
} as unknown as SessionListState
const useSessionsStub = <T,>(selector: (state: SessionListState) => T): T => selector(sessionsState)

describe('FilesView', () => {
  /** Mount the tree inside a context whose runCommand captures menu dispatch. */
  function mountFiles(fs: FsClient, root = '/w', onOpenFile = vi.fn()) {
    const editor = createEditorStore().create()
    const runCommand = vi.fn()
    const utils = render(
      <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces, runCommand } as never}>
        <FilesView fs={fs} root={root} onOpenFile={onOpenFile} />
      </WorkbenchContext.Provider>,
    )
    return { runCommand, ...utils }
  }

  it('renders the root children and opens files', async () => {
    const fs = fakeFs()
    const onOpenFile = vi.fn()
    mountFiles(fs, '/w', onOpenFile)
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.click(screen.getByText('a.txt'))
    expect(onOpenFile).toHaveBeenCalledWith('/w/a.txt')
  })

  it('lazily expands directories', async () => {
    const fs = fakeFs()
    mountFiles(fs)
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/sub"]')).toBeTruthy())
    expect(document.querySelector('[data-file-row="/w/sub/b.txt"]')).toBeNull()
    fireEvent.click(screen.getByText('sub'))
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/sub/b.txt"]')).toBeTruthy())
    expect(fs.listDir).toHaveBeenCalledWith('/w/sub')
  })

  it('surfaces listing errors', async () => {
    const fs = fakeFs()
    mountFiles(fs, '/missing')
    await waitFor(() => expect(document.querySelector('[data-file-row]')).toBeNull())
    expect(screen.getByText(/^missing: /)).toBeTruthy()
  })

  it('opens the context menu on a row and dispatches the row resource', async () => {
    const fs = fakeFs()
    const { runCommand } = mountFiles(fs)
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.contextMenu(document.querySelector('[data-file-row="/w/a.txt"]')!)
    expect(document.querySelector('[data-context-menu]')).toBeTruthy()
    expect(document.querySelectorAll('[data-context-menu-entry]')).toHaveLength(4)
    fireEvent.click(document.querySelector('[data-context-menu-entry="codeWorkbench.delete"]')!)
    expect(runCommand).toHaveBeenCalledWith('codeWorkbench.delete', { path: '/w/a.txt', isDirectory: false })
    expect(document.querySelector('[data-context-menu]')).toBeNull()
  })

  it('opens the context menu on the tree background with the root resource', async () => {
    const fs = fakeFs()
    const { runCommand } = mountFiles(fs)
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.contextMenu(document.querySelector('.dsh-wb-tree')!)
    fireEvent.click(document.querySelector('[data-context-menu-entry="codeWorkbench.newFile"]')!)
    expect(runCommand).toHaveBeenCalledWith('codeWorkbench.newFile', { path: '/w', isDirectory: true })
  })

  it('closes the context menu on Escape', async () => {
    const fs = fakeFs()
    mountFiles(fs)
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.contextMenu(document.querySelector('[data-file-row="/w/a.txt"]')!)
    expect(document.querySelector('[data-context-menu]')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-context-menu]')).toBeNull()
  })
})

describe('SidebarContent', () => {
  it('shows the file explorer for the files activity with the session cwd', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    expect(screen.getByText('/w')).toBeTruthy()
  })

  it('opens a file into the editor store', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.click(screen.getByText('a.txt'))
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs[0]?.path).toBe('/w/a.txt'))
    expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ content: 'content of /w/a.txt', version: 'v1', dirty: false })
  })

  it('surfaces an open failure without crashing', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/sub"]')).toBeTruthy())
    fireEvent.click(screen.getByText('sub'))
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/sub/b.txt"]')).toBeTruthy())
    fireEvent.click(screen.getByText('b.txt'))
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs).toHaveLength(0))
  })

  it('shows the AI assistant panel in the auxiliary bar', () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
        <AuxBarContent useSessions={useSessionsStub} />
      </WorkbenchContext.Provider>,
    )
    expect(document.querySelector('[data-ai-panel]')).toBeTruthy()
    // No bound session in tests: the panel shows its guidance.
    expect(screen.getByText(/Select or create a session/)).toBeTruthy()
  })

  it('dispatches New File from the toolbar with the workspace root resource', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    const runCommand = vi.fn()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces, runCommand }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('[data-file-row="/w/a.txt"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-explorer-new-file]')!)
    expect(runCommand).toHaveBeenCalledWith('codeWorkbench.newFile', { path: '/w', isDirectory: true })
  })

  it('remounts the tree when the shell bumps the fs-ops counter', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    const utils = render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(fs.listDir).toHaveBeenCalledTimes(1))
    utils.rerender(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={1} explorerError={undefined} />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(fs.listDir).toHaveBeenCalledTimes(2))
  })

  it('surfaces the explorer mutation error from the shell', async () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <SidebarContent activity="files" useSessions={useSessionsStub} fsOpsSeq={0} explorerError="rename denied" />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    expect(document.querySelector('[data-explorer-error]')?.textContent).toBe('rename denied')
  })
})

describe('AuxBarContent move menu', () => {
  /** Context kit with the shell-filled layout hook and panel actions. */
  function makeKit(aiLocation: AiLocation) {
    const moveAiTo = vi.fn()
    const toggleAuxBar = vi.fn()
    const panelActions = {
      togglePanel: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleAuxBar,
      togglePanelMaximize: vi.fn(),
      toggleMinimap: vi.fn(),
      moveAiTo,
    }
    const useLayout = <T,>(selector: (state: WorkbenchGeometryState) => T): T =>
      selector({ ...DEFAULT_GEOMETRY, aiLocation })
    return { panelActions, useLayout }
  }

  function mountAux(aiLocation: AiLocation) {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    const kit = makeKit(aiLocation)
    render(
      <WorkbenchContext.Provider
        value={{ editor, fs, fsOps, editorSurface, sessions, workspaces, panelActions: kit.panelActions, useLayout: kit.useLayout }}
      >
        <AuxBarContent useSessions={useSessionsStub} />
      </WorkbenchContext.Provider>,
    )
    return kit
  }

  it('moves the AI view between docks from the header menu', () => {
    const kit = mountAux('auxiliary')
    fireEvent.click(screen.getByRole('button', { name: 'Move AI Assistant' }))
    expect(document.querySelector('[data-ai-move-menu]')).toBeTruthy()
    expect(document.querySelectorAll('[data-ai-move]')).toHaveLength(4)
    expect(document.querySelector('[data-ai-move="auxiliary"]')?.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(document.querySelector('[data-ai-move="floating"]')!)
    expect(kit.panelActions.moveAiTo).toHaveBeenCalledWith('floating')
    expect(document.querySelector('[data-ai-move-menu]')).toBeNull()
  })

  it('marks the current dock in the move menu', () => {
    mountAux('panel')
    fireEvent.click(screen.getByRole('button', { name: 'Move AI Assistant' }))
    expect(document.querySelector('[data-ai-move="panel"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-ai-move="auxiliary"]')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('recalls the view to the auxiliary bar from another dock', () => {
    const kit = mountAux('floating')
    fireEvent.click(screen.getByRole('button', { name: 'Return to Auxiliary Bar' }))
    expect(kit.panelActions.moveAiTo).toHaveBeenCalledWith('auxiliary')
  })

  it('closes the auxiliary bar at the home dock', () => {
    const kit = mountAux('auxiliary')
    fireEvent.click(screen.getByRole('button', { name: 'Close Auxiliary Bar' }))
    expect(kit.panelActions.toggleAuxBar).toHaveBeenCalledTimes(1)
    expect(kit.panelActions.moveAiTo).not.toHaveBeenCalled()
  })
})

describe('EditorArea', () => {
  function mountEditor(editor: ReturnType<ReturnType<typeof createEditorStore>['create']>) {
    const fs = fakeFs()
    const utils = render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces }}>
          <EditorArea />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    return { editor, fs, ...utils }
  }

  it('shows the empty state without tabs', () => {
    mountEditor(createEditorStore().create())
    expect(screen.getByText(/Welcome to Code Mode/)).toBeTruthy()
  })

  it('opens the tab context menu and dispatches close for the right-clicked tab', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    const runCommand = vi.fn()
    const fs = fakeFs()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces, runCommand }}>
          <EditorArea />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    fireEvent.contextMenu(document.querySelector('[data-editor-tab="/w/a.txt"]')!)
    expect(document.querySelector('[data-context-menu]')).toBeTruthy()
    // Right-click activates the tab under the cursor before the menu opens.
    expect(editor.getSnapshot().groups[0]!.activePath).toBe('/w/a.txt')
    fireEvent.click(document.querySelector('[data-context-menu-entry="workbench.action.closeActiveEditor"]')!)
    expect(runCommand).toHaveBeenCalledWith('workbench.action.closeActiveEditor', { path: '/w/a.txt', isDirectory: false })
  })

  it('opens the editor-body context menu over the active tab', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    const runCommand = vi.fn()
    const fs = fakeFs()
    render(
      <I18nProvider>
        <WorkbenchContext.Provider value={{ editor, fs, fsOps, editorSurface, sessions, workspaces, runCommand }}>
          <EditorArea />
        </WorkbenchContext.Provider>
      </I18nProvider>,
    )
    fireEvent.contextMenu(document.querySelector('[data-editor-input="/w/a.txt"]')!)
    fireEvent.click(document.querySelector('[data-context-menu-entry="workbench.action.files.save"]')!)
    expect(runCommand).toHaveBeenCalledWith('workbench.action.files.save', { path: '/w/a.txt', isDirectory: false })
  })

  it('edits the active tab and saves with the version guard', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'hello', version: 'v1', dirty: false })
    const { fs } = mountEditor(editor)
    const input = document.querySelector('[data-editor-input="/w/a.txt"]') as HTMLTextAreaElement
    expect(input.value).toBe('hello')
    // Not dirty yet: save disabled.
    expect((document.querySelector('[data-editor-save]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'hello world' } })
    const save = document.querySelector('[data-editor-save]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(fs.writeText).toHaveBeenCalledWith('/w/a.txt', 'hello world', 'v1'))
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v9', dirty: false }))
  })

  it('switches tabs and closes them', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    mountEditor(editor)
    expect((document.querySelector('[data-editor-input="/w/b.txt"]') as HTMLTextAreaElement).value).toBe('b')
    fireEvent.click(screen.getByRole('button', { name: /^a\.txt/ }))
    expect((document.querySelector('[data-editor-input="/w/a.txt"]') as HTMLTextAreaElement).value).toBe('a')
    fireEvent.click(screen.getByRole('button', { name: 'Close a.txt' }))
    expect(editor.getSnapshot().groups[0]!.tabs.map(t => t.path)).toEqual(['/w/b.txt'])
  })

  it('splits into two groups, each rendering its own tabs and surface', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.split('horizontal')
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    mountEditor(editor)
    const panes = document.querySelectorAll('[data-editor-group]')
    expect(panes.length).toBe(2)
    expect(document.querySelector('[data-workbench-editor-area]')!.getAttribute('data-split-direction')).toBe('horizontal')
    // Each group has its own tab strip and active surface.
    expect(screen.getByRole('button', { name: /^a\.txt/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^b\.txt/ })).toBeTruthy()
    expect(document.querySelector('[data-editor-input="/w/a.txt"]')).toBeTruthy()
    expect(document.querySelector('[data-editor-input="/w/b.txt"]')).toBeTruthy()
  })

  it('joins groups back to one and restores a single group', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.split('vertical')
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    editor.actions.closeActiveGroup()
    const state = editor.getSnapshot()
    expect(state.groups).toHaveLength(1)
    expect(state.splitDirection).toBeUndefined()
    expect(state.groups[0]!.tabs.map(t => t.path)).toEqual(['/w/a.txt'])
  })

  it('closes a tab with a middle click', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    mountEditor(editor)
    fireEvent(screen.getByRole('button', { name: /^a\.txt/ }), new MouseEvent('auxclick', { button: 1, bubbles: true }))
    expect(editor.getSnapshot().groups[0]!.tabs.map(t => t.path)).toEqual(['/w/b.txt'])
  })

  it('renders preview tabs italic and pins them on double-click', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false, preview: true })
    mountEditor(editor)
    expect(screen.getByRole('button', { name: /^a\.txt/ }).className).toContain('dsh-wb-tab-preview')
    fireEvent.doubleClick(screen.getByRole('button', { name: /^a\.txt/ }))
    expect(editor.getSnapshot().groups[0]!.tabs[0]!.preview).toBe(false)
    expect(screen.getByRole('button', { name: /^a\.txt/ }).className).not.toContain('dsh-wb-tab-preview')
  })

  it('renders breadcrumbs for the focused group', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    mountEditor(editor)
    const crumbs = document.querySelector('[data-breadcrumbs]')!
    expect(crumbs.getAttribute('data-breadcrumbs-path')).toBe('/w/a.txt')
    expect(crumbs.textContent).toContain('a.txt')
  })

  it('drags a tab from one group onto the other group tab strip', () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a', version: 'v1', dirty: false })
    editor.actions.split('horizontal')
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    mountEditor(editor)
    const store: Record<string, string> = {}
    const transfer = {
      setData: (type: string, value: string) => { store[type] = value },
      getData: (type: string) => store[type] ?? '',
      effectAllowed: 'all',
      dropEffect: 'none',
    } as unknown as DataTransfer
    fireEvent.dragStart(screen.getByRole('button', { name: /^a\.txt/ }), { dataTransfer: transfer })
    expect(store['text/plain']).toBe('/w/a.txt')
    fireEvent.drop(document.querySelectorAll('[data-workbench-tabs]')[1]!, { dataTransfer: transfer })
    const groups = editor.getSnapshot().groups
    expect(groups[0]!.tabs.map(t => t.path)).toEqual([])
    expect(groups[1]!.tabs.map(t => t.path)).toEqual(['/w/b.txt', '/w/a.txt'])
    expect(editor.getSnapshot().activeGroupId).toBe(groups[1]!.id)
  })

  it('saves the active tab on the Ctrl+S request', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'hello', version: 'v1', dirty: true })
    const { fs } = mountEditor(editor)
    editor.actions.requestSave()
    await waitFor(() => expect(fs.writeText).toHaveBeenCalledWith('/w/a.txt', 'hello', 'v1'))
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v9', dirty: false }))
  })

  it('opens the conflict dialog on a stale save and overwrites without the guard', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'mine', version: 'v1', dirty: true })
    const { fs } = mountEditor(editor)
    fs.writeText = vi.fn(async (path: string, _content?: string, version?: string) => {
      if (version !== undefined) throw new FsGatewayError('FS_STALE_VERSION', 'stale')
      return { path, version: 'v9' }
    }) as typeof fs.writeText
    editor.actions.requestSave()
    await waitFor(() => expect(document.querySelector('[data-editor-conflict]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-conflict-overwrite]')!)
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ version: 'v9', dirty: false }))
    expect(fs.writeText).toHaveBeenLastCalledWith('/w/a.txt', 'mine')
    expect(document.querySelector('[data-editor-conflict]')).toBeNull()
  })

  it('discards local edits by re-reading the on-disk version', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'mine', version: 'v1', dirty: true })
    const { fs } = mountEditor(editor)
    fs.writeText = vi.fn(async () => { throw new FsGatewayError('FS_STALE_VERSION', 'stale') }) as typeof fs.writeText
    fs.readText = vi.fn(async (path: string) => ({ path, content: 'on-disk', version: 'v2' })) as typeof fs.readText
    editor.actions.requestSave()
    await waitFor(() => expect(document.querySelector('[data-editor-conflict]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-conflict-discard]')!)
    await waitFor(() => expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ content: 'on-disk', version: 'v2', dirty: false }))
    expect(document.querySelector('[data-editor-conflict]')).toBeNull()
  })

  it('saves a copy to a new path and restores the original tab', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'mine', version: 'v1', dirty: true })
    const { fs } = mountEditor(editor)
    fs.writeText = vi.fn(async (path: string, _content?: string, version?: string) => {
      if (version !== undefined) throw new FsGatewayError('FS_STALE_VERSION', 'stale')
      return { path, version: 'v9' }
    }) as typeof fs.writeText
    fs.readText = vi.fn(async (path: string) => ({ path, content: 'on-disk', version: 'v2' })) as typeof fs.readText
    editor.actions.requestSave()
    await waitFor(() => expect(document.querySelector('[data-editor-conflict]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-conflict-saveas]')!)
    const input = document.querySelector('[data-conflict-saveas-input]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '/w/copy.txt' } })
    fireEvent.click(document.querySelector('[data-conflict-saveas]')!)
    await waitFor(() => expect(document.querySelector('[data-editor-conflict]')).toBeNull())
    const tabs = editor.getSnapshot().groups[0]!.tabs
    expect(tabs.find(t => t.path === '/w/copy.txt')).toMatchObject({ content: 'mine', version: 'v9', dirty: false })
    expect(tabs.find(t => t.path === '/w/a.txt')).toMatchObject({ content: 'on-disk', version: 'v2', dirty: false })
  })

  it('cancels the conflict dialog and keeps the dirty tab', async () => {
    const editor = createEditorStore().create()
    editor.actions.openTab({ path: '/w/a.txt', content: 'mine', version: 'v1', dirty: true })
    const { fs } = mountEditor(editor)
    fs.writeText = vi.fn(async () => { throw new FsGatewayError('FS_STALE_VERSION', 'stale') }) as typeof fs.writeText
    editor.actions.requestSave()
    await waitFor(() => expect(document.querySelector('[data-editor-conflict]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-conflict-cancel]')!)
    expect(document.querySelector('[data-editor-conflict]')).toBeNull()
    expect(editor.getSnapshot().groups[0]!.tabs[0]).toMatchObject({ content: 'mine', dirty: true })
  })
})
