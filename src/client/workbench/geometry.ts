/**
 * Workbench layout store: the live geometry and visibility state of every
 * workbench region — primary sidebar, auxiliary bar, panel (with position
 * and maximize), and zen mode. Declared through the runtime's defineStore
 * (the same snapshot-store engine the harness layout store rides) with the
 * engine's own persistence: one localStorage entry per persist key, so a
 * reload restores the arrangement (VS Code parity). The key carries a shape
 * version; structural state changes bump it instead of migrating.
 */

import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Primary-sidebar activities; the AI assistant lives in the auxiliary bar. */
export type ActivityId = 'files' | 'search' | 'ai' | 'settings' | 'scm' | 'run' | 'extensions'

/** Dock position of the bottom/side panel (VS Code panel position setting). */
export type PanelPosition = 'bottom' | 'left' | 'right'

/** Where the AI assistant view lives (VS Code view mobility). */
export type AiLocation = 'auxiliary' | 'sidebar' | 'panel' | 'floating'

/** Live layout snapshot. */
export interface WorkbenchGeometryState {
  /** Primary sidebar column width in px. */
  sidebarWidth: number
  /** Auxiliary bar column width in px. */
  auxBarWidth: number
  /** Bottom panel height in px (panel docked bottom). */
  panelHeight: number
  /** Side panel width in px (panel docked left/right). */
  panelWidth: number
  /** Whether the primary sidebar column is collapsed to zero width. */
  sidebarCollapsed: boolean
  /** Whether the auxiliary bar is hidden. */
  auxBarHidden: boolean
  /** Whether the bottom panel is hidden. */
  panelCollapsed: boolean
  /** Dock position of the panel. */
  panelPosition: PanelPosition
  /** Whether the panel fills the editor area (VS Code maximize panel). */
  panelMaximized: boolean
  /** Zen mode: chrome hidden, editor only (status bar keeps the exit). */
  zen: boolean
  /** Active primary-sidebar activity entry. */
  activity: ActivityId
  /** Container of the AI assistant view (auxiliary bar by default). */
  aiLocation: AiLocation
  /** Whether the editor minimap is visible (VS Code minimap). */
  minimapEnabled: boolean
}

/** Sizing bounds enforced by the actions. */
export const SIDEBAR_WIDTH_RANGE: readonly [min: number, max: number] = [160, 640]
export const AUXBAR_WIDTH_RANGE: readonly [min: number, max: number] = [200, 800]
export const PANEL_HEIGHT_RANGE: readonly [min: number, max: number] = [80, 600]
export const PANEL_WIDTH_RANGE: readonly [min: number, max: number] = [200, 800]

/** Boot layout: Explorer in the primary sidebar, AI assistant in the
 * auxiliary bar, panel hidden (VS Code default sidebar width). */
export const DEFAULT_GEOMETRY: WorkbenchGeometryState = {
  sidebarWidth: 300,
  auxBarWidth: 300,
  panelHeight: 220,
  panelWidth: 420,
  sidebarCollapsed: false,
  auxBarHidden: false,
  panelCollapsed: true,
  panelPosition: 'bottom',
  panelMaximized: false,
  zen: false,
  activity: 'files',
  aiLocation: 'auxiliary',
  minimapEnabled: true,
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call. Draft is
 * peeled when the store engine bakes the actions.
 */
export type WorkbenchActions = {
  setSidebarWidth(draft: WorkbenchGeometryState, width: number): void
  setAuxBarWidth(draft: WorkbenchGeometryState, width: number): void
  setPanelHeight(draft: WorkbenchGeometryState, height: number): void
  setPanelWidth(draft: WorkbenchGeometryState, width: number): void
  setPanelCollapsed(draft: WorkbenchGeometryState, collapsed: boolean): void
  setAuxBarHidden(draft: WorkbenchGeometryState, hidden: boolean): void
  toggleSidebar(draft: WorkbenchGeometryState): void
  toggleAuxBar(draft: WorkbenchGeometryState): void
  togglePanel(draft: WorkbenchGeometryState): void
  setPanelPosition(draft: WorkbenchGeometryState, position: PanelPosition): void
  togglePanelMaximize(draft: WorkbenchGeometryState): void
  toggleZen(draft: WorkbenchGeometryState): void
  setActivity(draft: WorkbenchGeometryState, activity: ActivityId): void
  setAiLocation(draft: WorkbenchGeometryState, location: AiLocation): void
  toggleMinimap(draft: WorkbenchGeometryState): void
}

function clamp(value: number, [min, max]: readonly [min: number, max: number]): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Create one layout store handle (declared at apply time; the slot framework
 * instantiates one engine per root registration, persisted under the key
 * below).
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkbenchStore(): EngineStoreHandle<WorkbenchGeometryState, WorkbenchActions> {
  return defineStore({
    init: (): WorkbenchGeometryState => ({ ...DEFAULT_GEOMETRY }),
    persist: 'dsh.workbench.layout.v3',
    actions: {
      setSidebarWidth: (d, width: number) => {
        d.sidebarWidth = clamp(width, SIDEBAR_WIDTH_RANGE)
      },
      setAuxBarWidth: (d, width: number) => {
        d.auxBarWidth = clamp(width, AUXBAR_WIDTH_RANGE)
      },
      setPanelHeight: (d, height: number) => {
        d.panelHeight = clamp(height, PANEL_HEIGHT_RANGE)
      },
      setPanelWidth: (d, width: number) => {
        d.panelWidth = clamp(width, PANEL_WIDTH_RANGE)
      },
      setPanelCollapsed: (d, collapsed: boolean) => {
        d.panelCollapsed = collapsed
      },
      setAuxBarHidden: (d, hidden: boolean) => {
        d.auxBarHidden = hidden
      },
      toggleSidebar: (d) => {
        d.sidebarCollapsed = !d.sidebarCollapsed
      },
      toggleAuxBar: (d) => {
        d.auxBarHidden = !d.auxBarHidden
      },
      togglePanel: (d) => {
        d.panelCollapsed = !d.panelCollapsed
      },
      setPanelPosition: (d, position: PanelPosition) => {
        d.panelPosition = position
        d.panelCollapsed = false
        d.panelMaximized = false
      },
      togglePanelMaximize: (d) => {
        d.panelMaximized = !d.panelMaximized
        d.panelCollapsed = false
      },
      toggleZen: (d) => {
        d.zen = !d.zen
      },
      setActivity: (d, activity: ActivityId) => {
        d.activity = activity
      },
      setAiLocation: (d, location: AiLocation) => {
        d.aiLocation = location
      },
      toggleMinimap: (d) => {
        d.minimapEnabled = !d.minimapEnabled
      },
    },
  })
}
