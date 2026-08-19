/**
 * Workbench shell render tests: the six regions, activity switching, AI
 * auxiliary-bar toggling, sidebar/panel collapsing, panel docking, zen mode,
 * layout keybindings, and the mode switch. The shell is a pure container —
 * region content comes from the slot renderer, stubbed here as labeled
 * placeholders.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkbenchStore } from '../workbench/geometry.ts'
import { WorkbenchShell } from '../workbench/WorkbenchShell.tsx'
import { createEditorStore } from '../workbench/editor-store.ts'
import { installWorkbenchServices } from '../workbench/services.ts'
import { createFsClient, createFsOpsClient } from '../fs/client.ts'
import { I18nProvider } from '../i18n/I18nProvider.tsx'

/** Every test starts from clean persisted layout (the store persists). */
beforeEach(() => {
  globalThis.localStorage.clear()
})

/** Stub the slot renderer: each region renders a labeled placeholder div. */
function stubRenderSlot(key: string): React.ReactNode {
  return <div data-slot={key} />
}

/** Generic selector-hook stub: accepts any selector, never reads state. */
function stubHook<S>(_selector: (state: never) => S): S {
  return undefined as S
}

/** Mount the shell with a live engine instance and slot stubs. */
function mountShell() {
  const handle = createWorkbenchStore()
  const instance = handle.create()
  const useStore = <S,>(selector: (state: ReturnType<typeof instance.getSnapshot>) => S): S =>
    useSyncExternalStore(instance.subscribe, () => selector(instance.getSnapshot()))
  const utils = render(
    <I18nProvider>
      <WorkbenchShell
        useStore={useStore}
        renderSlot={stubRenderSlot}
        actions={instance.actions}
        useSessions={stubHook}
        useWorkspaces={stubHook}
      />
    </I18nProvider>,
  )
  return { instance, ...utils }
}

describe('WorkbenchShell', () => {
  it('renders the six regions with slot placeholders', () => {
    mountShell()
    expect(document.querySelector('[data-workbench-shell]')).toBeTruthy()
    expect(document.querySelector('[data-workbench-sidebar]')).toBeTruthy()
    expect(document.querySelector('[data-workbench-auxbar]')).toBeTruthy()
    expect(document.querySelector('[data-workbench-editor]')).toBeTruthy()
    expect(document.querySelector('[data-workbench-statusbar]')).toBeTruthy()
    // Activity rail renders the icon entries.
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
  })

  it('switches the primary-sidebar activity from the rail', () => {
    const { instance } = mountShell()
    expect(instance.getSnapshot().activity).toBe('files')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(instance.getSnapshot().activity).toBe('search')
    expect(screen.getByRole('button', { name: 'Search' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('collapses the sidebar when the active rail entry is clicked again', () => {
    const { instance } = mountShell()
    expect(instance.getSnapshot().sidebarCollapsed).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))
    expect(instance.getSnapshot().sidebarCollapsed).toBe(true)
  })

  it('toggles the auxiliary bar from the AI rail entry', () => {
    const { instance } = mountShell()
    expect(document.querySelector('[data-workbench-auxbar]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }))
    expect(instance.getSnapshot().auxBarHidden).toBe(true)
    expect(document.querySelector('[data-workbench-auxbar]')).toBeNull()
    expect(screen.getByRole('button', { name: 'AI Assistant' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('moves the AI view into the primary sidebar', () => {
    const { instance } = mountShell()
    act(() => { instance.actions.setAiLocation('sidebar') })
    expect(document.querySelector('[data-workbench-auxbar]')).toBeNull()
    expect(document.querySelector('[data-slot="workbench.sidebar"]')).toBeNull()
    expect(document.querySelector('[data-workbench-sidebar] [data-slot="workbench.auxbar"]')).toBeTruthy()
  })

  it('moves the AI view into the panel and keeps the terminal slot out', () => {
    const { instance } = mountShell()
    act(() => {
      instance.actions.setAiLocation('panel')
      instance.actions.togglePanel()
    })
    expect(document.querySelector('[data-workbench-auxbar]')).toBeNull()
    expect(document.querySelector('[data-slot="workbench.panel"]')).toBeNull()
    expect(document.querySelector('[data-workbench-panel] [data-slot="workbench.auxbar"]')).toBeTruthy()
  })

  it('floats the AI view over the editor and hides it in zen mode', () => {
    const { instance } = mountShell()
    act(() => { instance.actions.setAiLocation('floating') })
    expect(document.querySelector('[data-workbench-auxbar]')).toBeNull()
    expect(document.querySelector('[data-workbench-ai-floating] [data-slot="workbench.auxbar"]')).toBeTruthy()
    act(() => { instance.actions.toggleZen() })
    expect(document.querySelector('[data-workbench-ai-floating]')).toBeNull()
    act(() => { instance.actions.toggleZen() })
    expect(document.querySelector('[data-workbench-ai-floating]')).toBeTruthy()
  })

  it('recalls the AI view to the auxiliary bar from the rail entry', () => {
    const { instance } = mountShell()
    act(() => {
      instance.actions.setAiLocation('sidebar')
      instance.actions.toggleAuxBar()
    })
    expect(instance.getSnapshot().auxBarHidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }))
    expect(instance.getSnapshot().aiLocation).toBe('auxiliary')
    expect(instance.getSnapshot().auxBarHidden).toBe(false)
    expect(document.querySelector('[data-workbench-auxbar]')).toBeTruthy()
  })

  it('hides the sidebar when collapsed and restores it', () => {
    mountShell()
    expect(document.querySelector('[data-workbench-sidebar]')?.children.length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hide Sidebar' }))
    expect(document.querySelector('[data-workbench-sidebar]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show Sidebar' }))
    expect(document.querySelector('[data-workbench-sidebar]')?.children.length).toBe(1)
  })

  it('shows the bottom panel only when expanded', () => {
    mountShell()
    expect(document.querySelector('[data-workbench-panel]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show Panel' }))
    expect(document.querySelector('[data-workbench-panel]')?.getAttribute('data-panel-position')).toBe('bottom')
    fireEvent.click(screen.getByRole('button', { name: 'Hide Panel' }))
    expect(document.querySelector('[data-workbench-panel]')).toBeNull()
  })

  it('docks the panel to the side through the View menu', () => {
    const { instance } = mountShell()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Panel Right' }))
    expect(instance.getSnapshot().panelPosition).toBe('right')
    expect(document.querySelector('[data-workbench-panel]')?.getAttribute('data-panel-position')).toBe('right')
    // The editor stays present beside the side-docked panel.
    expect(document.querySelector('[data-slot="workbench.editor"]')).toBeTruthy()
  })

  it('maximizes the panel over the editor area', () => {
    const { instance } = mountShell()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Maximized Panel' }))
    expect(instance.getSnapshot().panelMaximized).toBe(true)
    expect(document.querySelector('[data-slot="workbench.editor"]')).toBeNull()
    expect(document.querySelector('[data-workbench-panel]')).toBeTruthy()
  })

  it('enters and leaves zen mode', () => {
    mountShell()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    // The chord binding rides the menu label.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Zen ModeCtrl+Z' }))
    expect(document.querySelector('[data-workbench-menubar]')).toBeNull()
    expect(document.querySelector('[data-workbench-activitybar]')).toBeNull()
    expect(document.querySelector('[data-workbench-sidebar]')).toBeNull()
    expect(document.querySelector('[data-workbench-auxbar]')).toBeNull()
    expect(document.querySelector('[data-exit-zen]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Exit Zen Mode' }))
    expect(document.querySelector('[data-workbench-menubar]')).toBeTruthy()
    expect(document.querySelector('[data-workbench-auxbar]')).toBeTruthy()
  })

  it('toggles layout regions from the keyboard', () => {
    const { instance } = mountShell()
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(instance.getSnapshot().sidebarCollapsed).toBe(true)
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true, altKey: true })
    expect(instance.getSnapshot().auxBarHidden).toBe(true)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(instance.getSnapshot().panelCollapsed).toBe(false)
    fireEvent.keyDown(window, { key: '`', ctrlKey: true })
    expect(instance.getSnapshot().panelCollapsed).toBe(true)
  })

  it('completes a two-step chord and shows the pending wait', () => {
    const { instance } = mountShell()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(document.querySelector('[data-chord-pending]')?.textContent).toContain('(Ctrl+K) was pressed. Waiting for second key of chord...')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(instance.getSnapshot().zen).toBe(true)
    expect(document.querySelector('[data-chord-pending]')).toBeNull()
  })

  it('cancels a pending chord on Esc and on timeout', () => {
    vi.useFakeTimers()
    try {
      const { instance } = mountShell()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(document.querySelector('[data-chord-pending]')).toBeTruthy()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(document.querySelector('[data-chord-pending]')).toBeNull()
      expect(instance.getSnapshot().zen).toBe(false)
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      act(() => { vi.advanceTimersByTime(1000) })
      expect(document.querySelector('[data-chord-pending]')).toBeNull()
      // After the timeout the second key is a fresh press: Ctrl+Z alone never
      // fires the chord command.
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
      expect(instance.getSnapshot().zen).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fires the orthogonal split from the Ctrl+K chord', () => {
    const editor = createEditorStore().create()
    installWorkbenchServices({
      editor,
      fs: createFsClient(),
      fsOps: createFsOpsClient(),
      sessions: { open: () => {}, binding: () => undefined },
      workspaces: { startSession: () => {} },
    })
    try {
      mountShell()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true })
      expect(editor.getSnapshot().groups).toHaveLength(2)
      expect(editor.getSnapshot().splitDirection).toBe('vertical')
    } finally {
      installWorkbenchServices(null as never)
    }
  })

  it('opens the quick-input surfaces from the keyboard', () => {
    const { instance } = mountShell()
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    expect(document.querySelector('[data-quick-input="files"]')).toBeTruthy()
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Escape' })
    expect(document.querySelector('[data-quick-input]')).toBeNull()
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true, shiftKey: true })
    expect(document.querySelector('[data-quick-input="commands"]')).toBeTruthy()
    // Filter to one command, accept it: the command runs and the widget closes.
    fireEvent.change(document.querySelector('[data-quick-input-field]')!, { target: { value: 'zen mode' } })
    fireEvent.keyDown(document.querySelector('[data-quick-input-field]')!, { key: 'Enter' })
    expect(document.querySelector('[data-quick-input]')).toBeNull()
    expect(instance.getSnapshot().zen).toBe(true)
  })

  it('marks the current mode in the status strip', () => {
    mountShell()
    expect(document.querySelector('[data-workbench-mode]')?.textContent).toContain('Code Mode')
  })

  it('offers the harness switch and applies it on click', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    mountShell()
    const button = screen.getByRole('button', { name: 'Exit Code Mode' })
    expect(button).toBeTruthy()
    fireEvent.click(button)
    expect(window.localStorage.getItem('dsh.workbench.mode')).toBe('harness')
    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
