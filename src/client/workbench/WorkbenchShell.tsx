/**
 * The workbench shell: the root-slot entry the plugin registers in code mode.
 *
 * The frame is the workbench grid: a menu bar in the title bar, an
 * icon activity rail, a resizable primary sidebar, the editor area with a
 * dockable panel (bottom/left/right, maximizable), a resizable auxiliary bar
 * (the AI assistant's container), and a two-sided status bar — plus zen
 * mode, which strips everything but the editor and the exit affordance.
 * Layout state lives in the persisted store seat; each region's content is
 * a child slot, so the frame stays a pure container. The shell also owns
 * the shared workbench services (editor store + fs client) and provides
 * them to every rendered region through context. Visual treatment comes
 * from the theme layer (theme/tokens.ts, theme/css.ts) — the shell carries
 * no styling literals.
 */

import { memo, useEffect, useRef, useSyncExternalStore, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { createFsClient, createFsOpsClient, basenameOf, dirnameOf } from '../fs/client.ts'
import { pickNativeDirectory } from '../fs/pick-directory.ts'
import { switchMode } from '../mode/switch.ts'
import { languageOf, languageLabelOf } from '../editor/EditorSurface.tsx'
import { ensureWorkbenchTheme } from '../theme/inject.ts'
import {
  IconChevronDown, IconChevronUp, IconFiles, IconLayoutSidebarLeft, IconLayoutSidebarRight,
  IconScm, IconSearch, IconSettingsGear, IconSparkle, IconExtensions, IconRun, IconGitBranch,
} from '../theme/codicons.tsx'
import { WorkbenchContext } from './editor-context.ts'
import type { EditorSelection, WorkbenchServices } from './editor-context.ts'
import { createEditorStore } from './editor-store.ts'
import { createGitClient } from '../git/client.ts'
import {
  createWorkbenchStore, DEFAULT_GEOMETRY,
} from './geometry.ts'
import type {
  ActivityId, WorkbenchGeometryState,
} from './geometry.ts'
import { readTheme, writeTheme, readIndent, writeIndent } from '../settings/store.ts'
import type { ThemePreference, IndentPreference } from '../settings/store.ts'
import { AuxBarContent } from './parts/AuxBarContent.tsx'
import { DirectoryPickerDialog } from './parts/DirectoryPickerDialog.tsx'
import { Sash } from './parts/Sash.tsx'
import { PanelContainer } from './panels/PanelContainer.tsx'
import { getWorkbenchServices } from './services.ts'
import { DEFAULT_KEYBINDINGS, MENUS, commandOf } from '../platform/commands.ts'
import type { CommandResource } from '../platform/commands.ts'
import { chordOfDef, keybindingLabel, resolveKeyPress } from '../platform/keybindings.ts'
import type { KeybindingDef } from '../platform/keybindings.ts'
import { QuickInput } from '../platform/QuickInput.tsx'
import type { QuickInputMode } from '../platform/QuickInput.tsx'
import { I18nProvider, useT } from '../i18n/I18nProvider.tsx'
import type { MessageId } from '../i18n/ids.ts'

/** Region keys the shell declares and renders. */
export type WorkbenchRegionKey =
  | 'workbench.activitybar'
  | 'workbench.sidebar'
  | 'workbench.auxbar'
  | 'workbench.editor'
  | 'workbench.panel'
  | 'workbench.statusbar'

/** Composed props the root registration delivers. */
export type WorkbenchShellProps =
  PropsRuntime<'root'>
  & PropsRenderSlots<WorkbenchRegionKey>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>

/** Primary-sidebar rail entries (explorer first). */
const MAIN_ACTIVITIES = [
  { id: 'files' as ActivityId, label: 'activity.explorer' as MessageId, Icon: IconFiles },
  { id: 'search' as ActivityId, label: 'activity.search' as MessageId, Icon: IconSearch },
  { id: 'scm' as ActivityId, label: 'activity.scm' as MessageId, Icon: IconScm },
  { id: 'run' as ActivityId, label: 'activity.run' as MessageId, Icon: IconRun },
  { id: 'extensions' as ActivityId, label: 'activity.extensions' as MessageId, Icon: IconExtensions },
]
const BOTTOM_ACTIVITIES = [
  { id: 'settings' as ActivityId, label: 'activity.settings' as MessageId, Icon: IconSettingsGear },
]

/** Select the live layout snapshot (the store seat's stable getSnapshot). */
function selectGeometry(state: WorkbenchGeometryState): WorkbenchGeometryState {
  return state
}

/** Panel dock style per position: fixed size per orientation, or flex when maximized. */
function panelStyle(geometry: WorkbenchGeometryState): React.CSSProperties {
  if (geometry.panelMaximized) return { flex: 1, minWidth: 0, minHeight: 0 }
  return geometry.panelPosition === 'bottom'
    ? { height: geometry.panelHeight }
    : { width: geometry.panelWidth }
}

/**
 * The root frame. Region contents render through the declared child slots;
 * the shell itself owns the menu bar, the activity rail, and the status bar.
 */
const WorkbenchShellContent = memo(function WorkbenchShellContent(props: WorkbenchShellProps) {
  const geometry = props.useStore(selectGeometry)
  const { actions } = props
  const { t } = useT()
  const [openMenu, setOpenMenu] = useState<string | undefined>()
  const [quickInput, setQuickInput] = useState<QuickInputMode | undefined>()
  // Two-step chord wait (Ctrl+K prefix): the pressed prefix and its 1s timer.
  const [pendingChord, setPendingChord] = useState<{ chord: string; def: KeybindingDef } | undefined>()
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  // Explorer mutation accounting: each success bumps the refresh counter the
  // sidebar slot receives (remounting the tree); failures surface there.
  const [fsOpsSeq, setFsOpsSeq] = useState(0)
  const [explorerError, setExplorerError] = useState<string | undefined>()
  // Workbench theme: persisted to localStorage and mirrored on the DOM so CSS
  // can react; also exposed through services so the editor surface can follow.
  const [theme, setTheme] = useState<ThemePreference>(() => readTheme(globalThis.localStorage))
  // Indent preference: persisted to localStorage and shown in the status bar.
  const [indent, setIndent] = useState<IndentPreference>(() => readIndent(globalThis.localStorage))
  // Standalone embeds mount without apply(): guarantee the stylesheet too.
  useEffect(() => { ensureWorkbenchTheme(document) }, [])
const CWD_STORAGE_KEY = 'dsh.workbench.workspace.cwd'

function readStoredCwd(storage: Storage): string | undefined {
  try {
    const val = storage.getItem(CWD_STORAGE_KEY)
    return val && val.length > 0 ? val : undefined
  } catch {
    return undefined
  }
}

function writeStoredCwd(storage: Storage, cwd: string | undefined): void {
  try {
    if (cwd === undefined) storage.removeItem(CWD_STORAGE_KEY)
    else storage.setItem(CWD_STORAGE_KEY, cwd)
  } catch {
    // Ignore storage errors
  }
}

  // Drag bases: region sizes captured at sash drag start (the sash reports
  // deltas; the actions take absolute sizes).
  const dragBaseRef = useRef({ sidebar: 0, auxBar: 0, panel: 0 })
  const sessionCwd = props.useSessions(state => state.current !== undefined ? state.byId[state.current]?.cwd : undefined)
  const [overrideCwd, setOverrideCwd] = useState<string | undefined>(() => readStoredCwd(globalThis.localStorage))
  const currentCwd = overrideCwd ?? sessionCwd

  // One service set per shell mount: the apply-time set when installed
  // (sessions/workspaces reachable only from the plugin body), else the
  // standalone fallback (tests, embeds) with fs and the editor only.
  const servicesRef = useRef<WorkbenchServices | null>(null)
  if (servicesRef.current === null) {
    servicesRef.current = getWorkbenchServices() ?? {
      editor: createEditorStore().create(),
      fs: createFsClient(),
      fsOps: createFsOpsClient(),
      // Standalone fallback: no host services; the AI panel shows its
      // no-session guidance.
      sessions: { open: () => {}, binding: () => undefined },
      workspaces: { startSession: () => {} },
      git: createGitClient(),
    }
  }

  const [gitBranch, setGitBranch] = useState<string | undefined>()

  useEffect(() => {
    if (currentCwd === undefined) {
      setGitBranch(undefined)
      return
    }
    let active = true
    void servicesRef.current?.git?.status(currentCwd).then((res) => {
      if (active && res.isRepo) {
        setGitBranch(res.branch ?? 'HEAD')
      } else if (active) {
        setGitBranch(undefined)
      }
    }).catch(() => {
      if (active) setGitBranch(undefined)
    })
    return () => { active = false }
  }, [currentCwd, fsOpsSeq])

  /** Run one mutation against the gateways, then refresh the explorer tree;
   * failures surface as the explorer error line. */
  const runExplorerOp = async (task: () => Promise<void>): Promise<void> => {
    try {
      setExplorerError(undefined)
      await task()
      setFsOpsSeq(seq => seq + 1)
    } catch (error) {
      setExplorerError(error instanceof Error ? error.message : String(error))
    }
  }

  /** Create one entry (file through the fs gateway, folder through fs-ops). */
  const createEntry = async (kind: 'file' | 'folder', parent: string, raw: string): Promise<void> => {
    const name = raw.trim()
    if (name === '' || /[/\\]/u.test(name)) {
      throw new Error(`"${raw}" is not a valid entry name`)
    }
    const target = `${parent.replace(/[/\\]+$/u, '')}/${name}`
    const services = servicesRef.current
    if (services === null) return
    if (kind === 'file') {
      const result = await services.fs.writeText(target, '')
      services.editor.actions.openTab({ path: target, content: '', version: result.version, dirty: false, preview: false })
    } else {
      const root = currentCwd
      if (root === undefined) return
      await services.fsOps.mkdir(root, target)
    }
  }

  /** Rename one entry, then re-home any open tab on its old path. */
  const renameEntry = async (path: string, raw: string): Promise<void> => {
    const name = raw.trim()
    if (name === '' || /[/\\]/u.test(name)) {
      throw new Error(`"${raw}" is not a valid entry name`)
    }
    const target = `${dirnameOf(path)}/${name}`
    if (target === path) return
    const services = servicesRef.current
    const root = currentCwd
    if (services === null || root === undefined) return
    const result = await services.fsOps.rename(root, path, target)
    services.editor.actions.renamePath(path, result.newPath)
  }

  /** Remove one entry and close any open tab on it. */
  const removeEntry = async (path: string): Promise<void> => {
    const services = servicesRef.current
    const root = currentCwd
    if (services === null || root === undefined) return
    await services.fsOps.remove(root, path)
    services.editor.actions.closeTab(path)
  }

  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false)

  /** The explorer verbs the command table runs against. */
  const explorer = {
    openFolder: (): void => {
      setDirectoryPickerOpen(true)
    },
    create: (kind: 'file' | 'folder', parentDir: string | undefined): void => {
      const parent = parentDir ?? currentCwd
      if (parent === undefined) return
      const title = kind === 'file' ? t('explorer.newFile') : t('explorer.newFolder')
      const placeholder = kind === 'file' ? t('explorer.newFileName') : t('explorer.newFolderName')
      setQuickInput({
        kind: 'prompt',
        title,
        value: '',
        placeholder,
        accept: (raw) => { void runExplorerOp(() => createEntry(kind, parent, raw)) },
      })
    },
    rename: (path: string): void => {
      setQuickInput({
        kind: 'prompt',
        title: t('explorer.rename'),
        value: basenameOf(path),
        placeholder: t('explorer.newFileName'),
        accept: (raw) => { void runExplorerOp(() => renameEntry(path, raw)) },
      })
    },
    remove: (path: string): void => {
      void runExplorerOp(() => removeEntry(path))
    },
  }

  /** Open the indent picker QuickInput. */
  const openIndentPicker = (): void => {
    setQuickInput({
      kind: 'select',
      title: t('status.indent.label'),
      items: [
        { label: t('status.indent.spaces', { size: 2 }), value: '2' },
        { label: t('status.indent.spaces', { size: 4 }), value: '4' },
        { label: t('status.indent.spaces', { size: 8 }), value: '8' },
        { label: t('status.indent.tabs'), value: 'tab' },
      ],
      accept: (value) => {
        const next = value === 'tab' ? 'tab' : (Number(value) as IndentPreference)
        setIndent(next)
        writeIndent(globalThis.localStorage, next)
      },
    })
  }

  /** Supported language choices for manual language mode switching. */
  const ALL_LANGUAGES = [
    { label: 'TypeScript', value: 'typescript' },
    { label: 'JavaScript', value: 'javascript' },
    { label: 'Python', value: 'python' },
    { label: 'Java', value: 'java' },
    { label: 'HTML', value: 'html' },
    { label: 'CSS', value: 'css' },
    { label: 'SCSS', value: 'scss' },
    { label: 'Less', value: 'less' },
    { label: 'JSON', value: 'json' },
    { label: 'YAML', value: 'yaml' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'Rust', value: 'rust' },
    { label: 'Go', value: 'go' },
    { label: 'C++', value: 'cpp' },
    { label: 'C', value: 'c' },
    { label: 'C#', value: 'csharp' },
    { label: 'PHP', value: 'php' },
    { label: 'Ruby', value: 'ruby' },
    { label: 'Swift', value: 'swift' },
    { label: 'Kotlin', value: 'kotlin' },
    { label: 'Scala', value: 'scala' },
    { label: 'Lua', value: 'lua' },
    { label: 'R', value: 'r' },
    { label: 'Dart', value: 'dart' },
    { label: 'Shell Script', value: 'shell' },
    { label: 'PowerShell', value: 'powershell' },
    { label: 'SQL', value: 'sql' },
    { label: 'XML', value: 'xml' },
    { label: 'INI / Config', value: 'ini' },
    { label: 'Dockerfile', value: 'dockerfile' },
    { label: 'Protocol Buffer', value: 'protobuf' },
    { label: 'Plain Text', value: 'plaintext' },
  ] as const

  const openLanguagePicker = (): void => {
    const editorStore = servicesRef.current?.editor
    const state = editorStore?.getSnapshot()
    const activeGrp = state?.groups.find(g => g.id === state.activeGroupId)
    const curPath = activeGrp?.activePath
    if (curPath === undefined) return
    setQuickInput({
      kind: 'select',
      title: '选择语言模式 (Change Language Mode)',
      items: ALL_LANGUAGES,
      accept: (selectedLanguage) => {
        editorStore?.actions.setLanguage(curPath, selectedLanguage)
      },
    })
  }

  /** Run one command id from the registry (menus, palette, keybindings,
   * context menus — the latter carry their explorer resource). */
  const runCommand = (commandId: string, resource?: CommandResource): void => {
    const command = commandOf(commandId)
    if (command === undefined) throw new Error(`unknown workbench command: ${commandId}`)
    setQuickInput(undefined)
    setOpenMenu(undefined)
    const editorStore = servicesRef.current?.editor
    command.run({
      layout: actions,
      quickInput: {
        openFiles: () => { setQuickInput({ kind: 'files' }) },
        openCommands: () => { setQuickInput({ kind: 'commands' }) },
      },
      editor: {
        split: (direction) => { editorStore?.actions.split(direction) },
        closeActiveGroup: () => { editorStore?.actions.closeActiveGroup() },
        closeActiveTab: () => {
          const state = editorStore?.getSnapshot()
          const group = state?.groups.find(candidate => candidate.id === state.activeGroupId)
          if (group?.activePath !== undefined) editorStore?.actions.closeTab(group.activePath)
        },
        save: () => { editorStore?.actions.requestSave() },
      },
      explorer,
      ...(resource === undefined ? {} : { resource }),
      exitCodeMode: () => { switchMode(globalThis.localStorage, 'harness') },
    })
  }

  // Keybindings: one dispatcher over the command table's default rules,
  // honoring two-step chords (the prefix waits 1s or until Esc). The listener
  // re-subscribes every render so its closure always sees the latest pending
  // prefix; the timeout itself survives renders and dies with the shell.
  const clearChordTimer = (): void => {
    if (chordTimerRef.current !== undefined) clearTimeout(chordTimerRef.current)
    chordTimerRef.current = undefined
  }

  /** Focus zones the shell cares about for keybinding dispatch. */
  type FocusZone = 'editor' | 'terminal' | 'quickinput' | 'chrome'

  /** Derive the current focus zone from the active element. */
  function focusZoneOf(): FocusZone {
    const activeEl = document.activeElement
    if (activeEl === null) return 'chrome'
    if (activeEl.closest('[data-workbench-editor]') !== null) return 'editor'
    if (activeEl.closest('[data-terminal-panel]') !== null) return 'terminal'
    if (activeEl.closest('[data-quick-input]') !== null) return 'quickinput'
    return 'chrome'
  }

  /** Command ids that are safe to handle while the editor area has focus. */
  const EDITOR_ZONE_COMMANDS = new Set([
    'workbench.action.files.openFolder',
    'codeWorkbench.newFile',
    'codeWorkbench.newFolder',
    'workbench.action.quickOpen',
    'workbench.action.showCommands',
    'workbench.action.toggleSidebarVisibility',
    'workbench.action.toggleAuxiliaryBar',
    'workbench.action.togglePanel',
    'workbench.action.splitEditorOrthogonal',
    'workbench.action.toggleZenMode',
    'workbench.action.terminal.toggleTerminal',
  ])

  /** Command ids that are safe to handle while the terminal panel has focus. */
  const TERMINAL_ZONE_COMMANDS = new Set([
    'workbench.action.terminal.toggleTerminal',
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const resolution = resolveKeyPress(DEFAULT_KEYBINDINGS, event, pendingChord?.chord)
      if (resolution === undefined) {
        // Esc or an unbound second key cancels the pending wait.
        clearChordTimer()
        setPendingChord(undefined)
        return
      }
      // Focus-context rule: only intercept shell keybindings that are relevant
      // to the current focus zone. Let everything else pass through to the
      // focused widget (Monaco / xterm / Quick Input / browser chrome).
      if (resolution.kind === 'command') {
        const zone = focusZoneOf()
        const allowed = zone === 'editor'
          ? EDITOR_ZONE_COMMANDS.has(resolution.commandId)
          : zone === 'terminal'
            ? TERMINAL_ZONE_COMMANDS.has(resolution.commandId)
            : true
        if (!allowed) return
      }
      event.preventDefault()
      if (resolution.kind === 'pending') {
        clearChordTimer()
        chordTimerRef.current = setTimeout(() => {
          chordTimerRef.current = undefined
          setPendingChord(undefined)
        }, 1000)
        setPendingChord({ chord: chordOfDef(resolution.prefix), def: resolution.prefix })
        return
      }
      clearChordTimer()
      setPendingChord(undefined)
      runCommand(resolution.commandId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  })
  // Uncollapse panel whenever a run command is fired
  useEffect(() => {
    const onRun = () => {
      if (geometry.panelCollapsed) {
        actions.setPanelCollapsed(false)
      }
    }
    window.addEventListener('dsh:terminal-run-command', onRun)
    return () => { window.removeEventListener('dsh:terminal-run-command', onRun) }
  }, [geometry.panelCollapsed, actions])

  // The layout verbs and reader regions use (panel/aux headers), plus the
  // command runner context menus dispatch through.
  servicesRef.current.panelActions = {
    togglePanel: () => { actions.togglePanel() },
    showPanel: () => {
      if (geometry.panelCollapsed) actions.setPanelCollapsed(false)
    },
    toggleSidebar: () => { actions.toggleSidebar() },
    toggleAuxBar: () => { actions.toggleAuxBar() },
    showAuxBar: () => {
      actions.setAiLocation('auxiliary')
      if (geometry.auxBarHidden) actions.toggleAuxBar()
    },
    togglePanelMaximize: () => { actions.togglePanelMaximize() },
    moveAiTo: (location) => { actions.setAiLocation(location) },
    toggleMinimap: () => { actions.toggleMinimap() },
  }
  servicesRef.current.runCommand = runCommand
  servicesRef.current.useLayout = props.useStore
  if (servicesRef.current !== null) {
    servicesRef.current.theme = theme
    servicesRef.current.setTheme = (next: ThemePreference) => {
      setTheme(next)
    }
  }
  // Sync theme changes to DOM and localStorage whenever state updates.
  useEffect(() => {
    document.documentElement.dataset.workbenchTheme = theme
    writeTheme(globalThis.localStorage, theme)
    if (servicesRef.current !== null) {
      servicesRef.current.theme = theme
    }
  }, [theme])
  // Persist indent changes.
  useEffect(() => { writeIndent(globalThis.localStorage, indent) }, [indent])
  // Keep minimapEnabled on services in sync with the geometry store.
  const minimapEnabled = props.useStore(s => s.minimapEnabled)
  if (servicesRef.current !== null) {
    servicesRef.current.minimapEnabled = minimapEnabled
  }
  // Cursor-position sink: the editor area reports into the status bar.
  const [selection, setSelection] = useState<EditorSelection | undefined>()
  servicesRef.current.selectionSink = setSelection
  servicesRef.current.selectionGet = () => selection
  // Status-bar language: derived from the active group's editor tab.
  const editorState = useSyncExternalStore(servicesRef.current.editor.subscribe, servicesRef.current.editor.getSnapshot)
  const activeGroup = editorState.groups.find(group => group.id === editorState.activeGroupId)
  const activePath = activeGroup?.activePath
  const activeTab = activeGroup?.tabs.find(t => t.path === activePath)
  const activeLanguage = activeTab?.language ?? (activePath !== undefined ? languageOf(activePath) : undefined)

  const sidebarVisible = !geometry.zen && !geometry.sidebarCollapsed
  const auxVisible = !geometry.zen && !geometry.auxBarHidden
  const panelVisible = !geometry.zen && !geometry.panelCollapsed
  // The AI assistant view is one logical slot contributed wherever its
  // location points (view mobility: auxiliary / sidebar / panel /
  // floating); its content registration stays on the auxbar slot.
  const aiView = props.renderSlot('workbench.auxbar', { useSessions: props.useSessions, currentCwd })
  const panelContent = geometry.aiLocation === 'panel' ? aiView : <PanelContainer useSessions={props.useSessions} currentCwd={currentCwd} />
  const auxPane = auxVisible && geometry.aiLocation === 'auxiliary' && (
    <>
      <Sash
        orientation="vertical"
        label="Resize Auxiliary Bar"
        onDragStart={() => { dragBaseRef.current.auxBar = geometry.auxBarWidth }}
        onResize={(delta) => { actions.setAuxBarWidth(dragBaseRef.current.auxBar - delta) }}
        onReset={() => { actions.setAuxBarWidth(DEFAULT_GEOMETRY.auxBarWidth) }}
      />
      <aside className="dsh-wb-aux" style={{ width: geometry.auxBarWidth }} data-workbench-auxbar>
        {aiView}
      </aside>
    </>
  )
  const editorPane = geometry.panelMaximized && panelVisible
    ? (
      // Maximized panel fills the editor area regardless of dock position.
      <div className="dsh-wb-center">
        <div className="dsh-wb-panel" style={panelStyle(geometry)} data-workbench-panel data-panel-position={geometry.panelPosition}>
          {panelContent}
        </div>
      </div>
    )
    : geometry.panelPosition === 'bottom'
      ? (
        <div className="dsh-wb-center">
          <div className="dsh-wb-editorgroup" data-workbench-editor>{props.renderSlot('workbench.editor', { currentCwd })}</div>
          {panelVisible && (
            <>
              <Sash
                orientation="horizontal"
                label="Resize Panel"
                onDragStart={() => { dragBaseRef.current.panel = geometry.panelHeight }}
                onResize={(delta) => { actions.setPanelHeight(dragBaseRef.current.panel - delta) }}
                onReset={() => { actions.setPanelHeight(DEFAULT_GEOMETRY.panelHeight) }}
              />
              <div className="dsh-wb-panel" style={panelStyle(geometry)} data-workbench-panel data-panel-position="bottom">
                {panelContent}
              </div>
            </>
          )}
        </div>
      )
      : (
          <div className="dsh-wb-row">
            {panelVisible && geometry.panelPosition === 'left' && (
              <>
                <div className="dsh-wb-panel" style={panelStyle(geometry)} data-workbench-panel data-panel-position="left">
                  {panelContent}
                </div>
                <Sash
                  orientation="vertical"
                  label="Resize Panel"
                  onDragStart={() => { dragBaseRef.current.panel = geometry.panelWidth }}
                  onResize={(delta) => { actions.setPanelWidth(dragBaseRef.current.panel + delta) }}
                  onReset={() => { actions.setPanelWidth(DEFAULT_GEOMETRY.panelWidth) }}
                />
              </>
            )}
            <div className="dsh-wb-editorgroup" data-workbench-editor>{props.renderSlot('workbench.editor', { currentCwd })}</div>
            {panelVisible && geometry.panelPosition === 'right' && (
            <>
              <Sash
                orientation="vertical"
                label="Resize Panel"
                onDragStart={() => { dragBaseRef.current.panel = geometry.panelWidth }}
                onResize={(delta) => { actions.setPanelWidth(dragBaseRef.current.panel - delta) }}
                onReset={() => { actions.setPanelWidth(DEFAULT_GEOMETRY.panelWidth) }}
              />
              <div className="dsh-wb-panel" style={panelStyle(geometry)} data-workbench-panel data-panel-position="right">
                {panelContent}
              </div>
            </>
          )}
        </div>
      )

  return (
    <WorkbenchContext.Provider value={servicesRef.current}>
      <div className="dsh-wb" data-workbench-shell data-zen={geometry.zen ? 'true' : 'false'}>
        {!geometry.zen && (
          <div className="dsh-wb-titlebar" data-workbench-menubar>
            {MENUS.map(menu => (
              <div key={menu.label} className="dsh-wb-menubar-item">
                <button
                  type="button"
                  className="dsh-wb-menubar-button"
                  aria-expanded={openMenu === menu.label}
                  onClick={() => { setOpenMenu(openMenu === menu.label ? undefined : menu.label) }}
                  data-menu={menu.label}
                >
                  {t(menu.label as MessageId)}
                </button>
                {openMenu === menu.label && (
                  <div className="dsh-wb-menu-dropdown" data-menu-dropdown={menu.label}>
                    {menu.items.map(item => {
                      const command = commandOf(item.commandId)
                      if (command === undefined) throw new Error(`menu references unknown command ${item.commandId}`)
                      return (
                        <button
                          key={command.id}
                          type="button"
                          className="dsh-wb-menu-entry"
                          onClick={() => { runCommand(command.id) }}
                          data-menu-command={command.id}
                        >
                          <span>{t(command.title)}</span>
                          {command.binding !== undefined && (
                            <span className="dsh-wb-menu-keybinding">{keybindingLabel(command.binding.def)}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className="dsh-wb-commandcenter" data-command-center>
              <input
                className="dsh-wb-commandcenter-input"
                placeholder={t('cmd.quickOpen.title')}
                onFocus={() => { setQuickInput({ kind: 'files' }) }}
                data-command-center-input
              />
            </div>
            <div className="dsh-wb-titlebar-actions" data-titlebar-actions>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title={geometry.panelCollapsed ? t('status.showPanel') : t('status.hidePanel')}
                aria-label={geometry.panelCollapsed ? t('status.showPanel') : t('status.hidePanel')}
                onClick={() => { actions.togglePanel() }}
                data-layout-toggle="panel"
              >
                {geometry.panelCollapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
              </button>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title={geometry.auxBarHidden ? t('status.showAuxBar') : t('status.hideAuxBar')}
                aria-label={geometry.auxBarHidden ? t('status.showAuxBar') : t('status.hideAuxBar')}
                onClick={() => { actions.toggleAuxBar() }}
                data-layout-toggle="auxbar"
              >
                <IconLayoutSidebarRight size={16} />
              </button>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title={geometry.sidebarCollapsed ? t('status.showSidebar') : t('status.hideSidebar')}
                aria-label={geometry.sidebarCollapsed ? t('status.showSidebar') : t('status.hideSidebar')}
                onClick={() => { actions.toggleSidebar() }}
                data-layout-toggle="sidebar"
              >
                <IconLayoutSidebarLeft size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="dsh-wb-body">
          {!geometry.zen && (
            <div className="dsh-wb-activitybar" data-workbench-activitybar>
              {MAIN_ACTIVITIES.map(activity => (
                <button
                  key={activity.id}
                  type="button"
                  className="dsh-wb-activity-action"
                  title={t(activity.label)}
                  aria-label={t(activity.label)}
                  aria-pressed={geometry.activity === activity.id && sidebarVisible}
                  onClick={() => {
                    if (geometry.activity === activity.id) actions.toggleSidebar()
                    else actions.setActivity(activity.id)
                  }}
                  data-activity={activity.id}
                >
                  <activity.Icon size={24} />
                </button>
              ))}
              <div className="dsh-wb-activitybar-spacer" />
              {BOTTOM_ACTIVITIES.map(activity => (
                <button
                  key={activity.id}
                  type="button"
                  className="dsh-wb-activity-action"
                  title={t(activity.label)}
                  aria-label={t(activity.label)}
                  aria-pressed={geometry.activity === activity.id && sidebarVisible}
                  onClick={() => {
                    if (geometry.activity === activity.id) actions.toggleSidebar()
                    else actions.setActivity(activity.id)
                  }}
                  data-activity={activity.id}
                >
                  <activity.Icon size={24} />
                </button>
              ))}
              <button
                type="button"
                className="dsh-wb-activity-action"
                title={t('activity.aiAssistant')}
                aria-label={t('activity.aiAssistant')}
                aria-pressed={geometry.aiLocation === 'auxiliary' && auxVisible}
                onClick={() => {
                  if (geometry.aiLocation === 'auxiliary') actions.toggleAuxBar()
                  else {
                    actions.setAiLocation('auxiliary')
                    if (geometry.auxBarHidden) actions.toggleAuxBar()
                  }
                }}
                data-activity="ai"
              >
                <IconSparkle size={24} />
              </button>
            </div>
          )}
          {sidebarVisible && (
            <>
              <aside
                className="dsh-wb-sidebar"
                style={{ width: geometry.sidebarWidth }}
                data-workbench-sidebar
              >
                {geometry.aiLocation === 'sidebar'
                  ? aiView
                  : props.renderSlot('workbench.sidebar', {
                      activity: geometry.activity,
                      fsOpsSeq,
                      explorerError,
                      currentCwd,
                    })}
              </aside>
              <Sash
                orientation="vertical"
                label="Resize Sidebar"
                onDragStart={() => { dragBaseRef.current.sidebar = geometry.sidebarWidth }}
                onResize={(delta) => { actions.setSidebarWidth(dragBaseRef.current.sidebar + delta) }}
                onReset={() => { actions.setSidebarWidth(DEFAULT_GEOMETRY.sidebarWidth) }}
              />
            </>
          )}
          {editorPane}
          {auxPane}
          {geometry.aiLocation === 'floating' && !geometry.zen && (
            <div className="dsh-wb-aifloat" data-workbench-ai-floating>
              {aiView}
            </div>
          )}
        </div>
        <footer className="dsh-wb-statusbar" data-workbench-statusbar>
          {props.renderSlot('workbench.statusbar', {})}
          <div className="dsh-wb-statusbar-left">
            <span className="dsh-wb-statusitem dsh-wb-statusitem-remote" data-workbench-mode>
              {t('status.codeMode')}
            </span>
            {gitBranch !== undefined && (
              <button
                type="button"
                className="dsh-wb-statusitem"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit' }}
                onClick={() => { actions.setActivity('scm') }}
                data-status-git-branch
              >
                <IconGitBranch size={13} />
                <span>{gitBranch}</span>
              </button>
            )}
            {pendingChord !== undefined && (
              <span className="dsh-wb-statusitem" data-chord-pending>
                ({keybindingLabel(pendingChord.def)}) {t('status.chordWaiting')}
              </span>
            )}
            {geometry.zen && (
              <button
                type="button"
                className="dsh-wb-statusitem"
                onClick={() => { actions.toggleZen() }}
                data-exit-zen
              >
                {t('status.exitZenMode')}
              </button>
            )}
          </div>
          <div className="dsh-wb-statusbar-right">
            {activePath !== undefined && (
              <button
                type="button"
                className="dsh-wb-statusitem"
                onClick={openLanguagePicker}
                title="选择语言模式 (Change Language Mode)"
                data-status-language
              >
                {languageLabelOf(activeLanguage ?? activePath)}
              </button>
            )}
            {selection !== undefined && selection.path === activePath && (
              <span className="dsh-wb-statusitem" data-status-cursor>Ln {selection.line}, Col {selection.col}</span>
            )}
            <span className="dsh-wb-statusitem">{t('status.utf8')}</span>
            <button
              type="button"
              className="dsh-wb-statusitem"
              onClick={openIndentPicker}
              data-status-indent
            >
              {indent === 'tab' ? t('status.indent.tabs') : t('status.indent.spaces', { size: indent })}
            </button>
            <button
              type="button"
              className="dsh-wb-statusitem"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              title="行内 AI 代码补全 (Cursor-style Inline Copilot)"
              data-status-copilot
            >
              <IconSparkle size={12} />
              <span>Copilot</span>
            </button>
            <button
              type="button"
              className="dsh-wb-statusitem"
              onClick={() => { switchMode(globalThis.localStorage, 'harness') }}
            >
              {t('status.exitCodeMode')}
            </button>
          </div>
        </footer>
        {quickInput !== undefined && (
          <QuickInput
            mode={quickInput}
            useSessions={props.useSessions}
            onClose={() => { setQuickInput(undefined) }}
            runCommand={runCommand}
          />
        )}
        {directoryPickerOpen && (
          <DirectoryPickerDialog
            initialPath={currentCwd ?? 'D:\\deepseek-harness'}
            fs={servicesRef.current?.fs ?? createFsClient()}
            onSelect={(path) => {
              setOverrideCwd(path)
              writeStoredCwd(globalThis.localStorage, path)
              setFsOpsSeq(seq => seq + 1)
            }}
            onClose={() => { setDirectoryPickerOpen(false) }}
          />
        )}
      </div>
    </WorkbenchContext.Provider>
  )
})

export const WorkbenchShell = memo(function WorkbenchShell(props: WorkbenchShellProps) {
  return (
    <I18nProvider>
      <WorkbenchShellContent {...props} />
    </I18nProvider>
  )
})

/**
 * Convenience hook binding the store instance for standalone use outside the
 * slot machinery (tests and future standalone embeds).
 */
export function useWorkbenchGeometry(instance: ReturnType<ReturnType<typeof createWorkbenchStore>['create']>): WorkbenchGeometryState {
  return useSyncExternalStore(instance.subscribe, instance.getSnapshot)
}
