/**
 * Workbench services context: the editor store instance and the fs client the
 * workbench regions share. The shell owns one instance set and provides it to
 * its rendered regions; standalone renders (tests, embeds) provide their own.
 *
 * The sessions/workspaces faces are deliberately narrow plugin-owned slices
 * of the host services: the plugin must keep working across dsh releases, so
 * it types only the verbs it calls.
 */

import { createContext, useContext } from 'react'
import type { FC } from 'react'
import type { EngineStoreInstance, SessionBinding } from '@deepseek-ai/dsh-client-runtime/client'
import type { EditorSurfaceProps } from '../editor/EditorSurface.tsx'
import type { TerminalClient } from '../terminal/terminal-client.ts'
import type { CommandResource } from '../platform/commands.ts'
import type { FsClient, FsOpsClient } from '../fs/client.ts'
import type { GitClient } from '../git/client.ts'
import type { EditorActions, EditorState } from './editor-store.ts'
import type { AiLocation, WorkbenchGeometryState } from './geometry.ts'
import type { ThemePreference } from '../settings/store.ts'

/** The sessions verbs the workbench calls (host ISessions slice). */
export interface WorkbenchSessions {
  /** Select a session as current. */
  open(id: string): void
  /** Resolve the stable session binding (scope-addressed assembly feed). */
  binding(id: string): SessionBinding | undefined
}

/** The workspaces verbs the workbench calls (host IWorkspaces slice). */
export interface WorkbenchWorkspaces {
  /** The New Session flow on the current or recent workspace. */
  startSession(): void
  /** Native directory picker dialog on host. */
  pickDirectory?(): Promise<string | null>
}

/** Layout verbs regions may trigger (the shell's baked store actions). */
export interface PanelActions {
  togglePanel(): void
  toggleSidebar(): void
  toggleAuxBar(): void
  /** Explicitly open the auxiliary bar and ensure AI Assistant is focused. */
  showAuxBar?(): void
  togglePanelMaximize(): void
  /** Dock the AI assistant view into another container. */
  moveAiTo(location: AiLocation): void
  /** Toggle the editor minimap. */
  toggleMinimap(): void
}

/** Cursor/selection report from the editor surface (1-based line/col). */
export interface EditorSelection {
  /** The tab the selection belongs to (the status bar ignores stale reports). */
  readonly path: string
  readonly line: number
  readonly col: number
  /** Selected text ('' for a collapsed cursor). */
  readonly text: string
}

/** The per-shell service set regions consume. */
export interface WorkbenchServices {
  /** Live editor-store instance (tabs shared between explorer and editor). */
  readonly editor: EngineStoreInstance<EditorState, EditorActions>
  /** Filesystem gateway client. */
  readonly fs: FsClient
  /** Structural fs mutations (mkdir/rename/remove) gateway client. */
  readonly fsOps: FsOpsClient
  /** Sessions service slice (list, open, bind a session face). */
  readonly sessions: WorkbenchSessions
  /** Workspaces service slice (new-session flow). */
  readonly workspaces: WorkbenchWorkspaces
  /**
   * The editor body surface. Defaults to the Monaco surface; tests inject
   * the deterministic textarea stand-in.
   */
  readonly editorSurface?: FC<EditorSurfaceProps>
  /** Terminal gateway client (the bottom panel; absent in standalone renders). */
  readonly terminal?: TerminalClient
  /** Git gateway client. */
  readonly git?: GitClient
  /** Layout verbs (filled by the shell at render time; panel headers use them). */
  panelActions?: PanelActions
  /** Cursor-position sink (filled by the shell; the status bar reads it). */
  selectionSink?: (selection: EditorSelection) => void
  /** Latest editor selection read (filled by the shell; the AI panel attaches it). */
  selectionGet?: () => EditorSelection | undefined
  /**
   * Command runner with the context-menu resource (filled by the shell at
   * render time): context menus, the palette, and keybindings all dispatch
   * through the same command table.
   */
  runCommand?: (commandId: string, resource?: CommandResource) => void
  /**
   * Layout-state selector hook (filled by the shell at render time): regions
   * that need geometry facts — the panel maximize state, say — read slices
   * through it instead of reaching into the store.
   */
  useLayout?: <S>(selector: (state: WorkbenchGeometryState) => S) => S
  /** Current theme preference (set by the shell; regions read it). */
  theme?: ThemePreference
  /** Update the theme preference (filled by the shell at render time). */
  setTheme?: (theme: ThemePreference) => void
  /** Whether the editor minimap is enabled (set by the shell; editor surface reads it). */
  minimapEnabled?: boolean
}

/** React seat for the services; null outside a workbench shell render. */
export const WorkbenchContext = createContext<WorkbenchServices | null>(null)

/** Read the shell services; throws outside a workbench render (fail loud). */
export function useWorkbench(): WorkbenchServices {
  const services = useContext(WorkbenchContext)
  if (services === null) {
    throw new Error('useWorkbench: no workbench services context — render inside WorkbenchShell')
  }
  return services
}
