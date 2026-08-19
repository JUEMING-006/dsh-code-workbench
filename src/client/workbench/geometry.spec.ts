import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUXBAR_WIDTH_RANGE, createWorkbenchStore, DEFAULT_GEOMETRY, PANEL_HEIGHT_RANGE,
  PANEL_WIDTH_RANGE, SIDEBAR_WIDTH_RANGE,
} from './geometry.ts'

/** Every test starts from clean persisted layout (the store persists). */
beforeEach(() => {
  globalThis.localStorage.clear()
})

describe('workbench geometry store', () => {
  it('boots with the default geometry', () => {
    const instance = createWorkbenchStore().create()
    expect(instance.getSnapshot()).toEqual(DEFAULT_GEOMETRY)
  })

  it('notifies subscribers on every change and unsubscribes', () => {
    const instance = createWorkbenchStore().create()
    let calls = 0
    const off = instance.subscribe(() => { calls += 1 })
    instance.actions.toggleSidebar()
    expect(calls).toBe(1)
    off()
    instance.actions.togglePanel()
    expect(calls).toBe(1)
  })

  it('clamps sidebar width to the declared range', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.setSidebarWidth(10)
    expect(instance.getSnapshot().sidebarWidth).toBe(SIDEBAR_WIDTH_RANGE[0])
    instance.actions.setSidebarWidth(9999)
    expect(instance.getSnapshot().sidebarWidth).toBe(SIDEBAR_WIDTH_RANGE[1])
    instance.actions.setSidebarWidth(400)
    expect(instance.getSnapshot().sidebarWidth).toBe(400)
  })

  it('clamps panel height and width to their ranges', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.setPanelHeight(0)
    expect(instance.getSnapshot().panelHeight).toBe(PANEL_HEIGHT_RANGE[0])
    instance.actions.setPanelHeight(9999)
    expect(instance.getSnapshot().panelHeight).toBe(PANEL_HEIGHT_RANGE[1])
    instance.actions.setPanelWidth(0)
    expect(instance.getSnapshot().panelWidth).toBe(PANEL_WIDTH_RANGE[0])
    instance.actions.setPanelWidth(9999)
    expect(instance.getSnapshot().panelWidth).toBe(PANEL_WIDTH_RANGE[1])
  })

  it('clamps auxiliary bar width to the declared range', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.setAuxBarWidth(10)
    expect(instance.getSnapshot().auxBarWidth).toBe(AUXBAR_WIDTH_RANGE[0])
    instance.actions.setAuxBarWidth(9999)
    expect(instance.getSnapshot().auxBarWidth).toBe(AUXBAR_WIDTH_RANGE[1])
    instance.actions.setAuxBarWidth(420)
    expect(instance.getSnapshot().auxBarWidth).toBe(420)
  })

  it('toggles sidebar, auxiliary bar, and panel independently', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.toggleSidebar()
    expect(instance.getSnapshot().sidebarCollapsed).toBe(true)
    instance.actions.toggleSidebar()
    expect(instance.getSnapshot().sidebarCollapsed).toBe(false)
    instance.actions.toggleAuxBar()
    expect(instance.getSnapshot().auxBarHidden).toBe(true)
    instance.actions.togglePanel()
    expect(instance.getSnapshot().panelCollapsed).toBe(false)
  })

  it('moves the panel: docking shows it and clears maximize', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.togglePanelMaximize()
    expect(instance.getSnapshot().panelMaximized).toBe(true)
    expect(instance.getSnapshot().panelCollapsed).toBe(false)
    instance.actions.setPanelPosition('right')
    expect(instance.getSnapshot().panelPosition).toBe('right')
    expect(instance.getSnapshot().panelCollapsed).toBe(false)
    expect(instance.getSnapshot().panelMaximized).toBe(false)
  })

  it('toggles zen mode', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.toggleZen()
    expect(instance.getSnapshot().zen).toBe(true)
    instance.actions.toggleZen()
    expect(instance.getSnapshot().zen).toBe(false)
  })

  it('switches the active activity', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.setActivity('search')
    expect(instance.getSnapshot().activity).toBe('search')
    instance.actions.setActivity('settings')
    expect(instance.getSnapshot().activity).toBe('settings')
  })

  it('moves the AI assistant view between containers', () => {
    const instance = createWorkbenchStore().create()
    expect(instance.getSnapshot().aiLocation).toBe('auxiliary')
    instance.actions.setAiLocation('sidebar')
    expect(instance.getSnapshot().aiLocation).toBe('sidebar')
    instance.actions.setAiLocation('panel')
    expect(instance.getSnapshot().aiLocation).toBe('panel')
    instance.actions.setAiLocation('floating')
    expect(instance.getSnapshot().aiLocation).toBe('floating')
  })

  it('restores the layout across instances (persistence round-trip)', () => {
    const first = createWorkbenchStore().create()
    first.actions.setSidebarWidth(420)
    first.actions.setPanelPosition('right')
    first.actions.toggleAuxBar()
    first.actions.setAiLocation('floating')
    const second = createWorkbenchStore().create()
    expect(second.getSnapshot().sidebarWidth).toBe(420)
    expect(second.getSnapshot().panelPosition).toBe('right')
    expect(second.getSnapshot().auxBarHidden).toBe(true)
    expect(second.getSnapshot().aiLocation).toBe('floating')
  })

  it('falls back to defaults on a corrupt persisted entry', () => {
    globalThis.localStorage.setItem('dsh.workbench.layout.v2', '{not json')
    const instance = createWorkbenchStore().create()
    expect(instance.getSnapshot()).toEqual(DEFAULT_GEOMETRY)
  })

  it('clearPersisted drops the stored layout', () => {
    const instance = createWorkbenchStore().create()
    instance.actions.setSidebarWidth(420)
    instance.clearPersisted()
    expect(globalThis.localStorage.getItem('dsh.workbench.layout.v2')).toBeNull()
    expect(createWorkbenchStore().create().getSnapshot()).toEqual(DEFAULT_GEOMETRY)
  })
})
