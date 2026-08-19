/**
 * Status-bar cursor readout: the editor area reports cursor positions into
 * the shell through the services context; the status bar shows "Ln x, Col y"
 * for the active tab only. The shell's standalone service fallback cannot
 * receive a caller-owned editor store, so this file installs the apply-time
 * service set (services.installWorkbenchServices) and renders the real
 * EditorArea in the editor slot.
 */
import { fireEvent, render, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TextareaEditorSurface } from '../editor/EditorSurface.tsx'
import { createWorkbenchStore } from '../workbench/geometry.ts'
import { createEditorStore } from '../workbench/editor-store.ts'
import { EditorArea } from '../workbench/parts/EditorArea.tsx'
import { installWorkbenchServices } from '../workbench/services.ts'
import { WorkbenchShell } from '../workbench/WorkbenchShell.tsx'
import { I18nProvider } from '../i18n/I18nProvider.tsx'

beforeEach(() => {
  globalThis.localStorage.clear()
})

/** Slot renderer stubs every region except the editor (the real EditorArea). */
function stubRenderSlot(key: string): React.ReactNode {
  if (key === 'workbench.editor') return <EditorArea />
  return <div data-slot={key} />
}

function stubHook<S>(_selector: (state: never) => S): S {
  return undefined as S
}

/** Mount the shell over a caller-owned editor store and fake fs client. */
function mountShellWithEditor() {
  const editorHandle = createEditorStore()
  const editor = editorHandle.create()
  const fs = {
    readText: vi.fn(async (path: string) => ({ path, content: 'a\nb', version: 'v1' })),
    writeText: vi.fn(async (path: string) => ({ path, version: 'v9' })),
    listDir: vi.fn(async () => ({ path: '', entries: [] })),
    listAll: vi.fn(async () => ({ root: '', files: [] })),
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '/w', pattern: '', matches: [], truncated: false })),
    replace: vi.fn(async () => ({ path: '', version: '' })),
  }
  installWorkbenchServices({
    editor,
    fs,
    fsOps: { mkdir: vi.fn(), rename: vi.fn(), remove: vi.fn() },
    editorSurface: TextareaEditorSurface,
    sessions: { open: vi.fn(), binding: vi.fn(() => undefined) },
    workspaces: { startSession: vi.fn() },
  })
  const layoutHandle = createWorkbenchStore()
  const layout = layoutHandle.create()
  const useStore = <S,>(selector: (state: ReturnType<typeof layout.getSnapshot>) => S): S =>
    useSyncExternalStore(layout.subscribe, () => selector(layout.getSnapshot()))
  const utils = render(
    <I18nProvider>
      <WorkbenchShell
        useStore={useStore}
        renderSlot={stubRenderSlot}
        actions={layout.actions}
        useSessions={stubHook}
        useWorkspaces={stubHook}
      />
    </I18nProvider>,
  )
  return { editor, layout, ...utils }
}

describe('status bar cursor readout', () => {
  it('shows Ln/Col for the active tab when the cursor moves', async () => {
    const { editor } = mountShellWithEditor()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a\nb', version: 'v1', dirty: false })
    await waitFor(() => expect(document.querySelector('[data-editor-input="/w/a.txt"]')).toBeTruthy())
    const textarea = document.querySelector('[data-editor-input="/w/a.txt"]') as HTMLTextAreaElement
    textarea.selectionStart = 3
    textarea.selectionEnd = 3
    fireEvent.select(textarea)
    await waitFor(() => expect(document.querySelector('[data-status-cursor]')?.textContent).toBe('Ln 2, Col 2'))
  })

  it('hides the readout after switching to a tab without a cursor report', async () => {
    const { editor } = mountShellWithEditor()
    editor.actions.openTab({ path: '/w/a.txt', content: 'a\nb', version: 'v1', dirty: false })
    editor.actions.openTab({ path: '/w/b.txt', content: 'b', version: 'v1', dirty: false })
    await waitFor(() => expect(document.querySelector('[data-editor-input="/w/b.txt"]')).toBeTruthy())
    const textarea = document.querySelector('[data-editor-input="/w/b.txt"]') as HTMLTextAreaElement
    textarea.selectionStart = 1
    textarea.selectionEnd = 1
    fireEvent.select(textarea)
    await waitFor(() => expect(document.querySelector('[data-status-cursor]')).toBeTruthy())
    // The a tab never reported a cursor: the stale b-tab readout disappears.
    editor.actions.activate('/w/a.txt')
    await waitFor(() => expect(document.querySelector('[data-editor-input="/w/a.txt"]')).toBeTruthy())
    expect(document.querySelector('[data-status-cursor]')).toBeNull()
  })
})
