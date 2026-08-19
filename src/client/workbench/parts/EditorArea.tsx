/**
 * Editor area: one or two editor groups (Ctrl+\ split), each with its own
 * tab strip and active-tab surface, divided by a draggable sash. The surface
 * is pluggable — Monaco by default (loaded at runtime, see
 * editor/EditorSurface.tsx), textarea in tests — and the tab/store mechanics
 * are surface-independent.
 *
 * Save orchestration lives here (not per group): the toolbar Save button and
 * the Ctrl+S command (store saveRequestSeq) both save the active tab through
 * the version guard; a stale-version rejection opens the conflict dialog
 * (overwrite / discard / save-as / cancel).
 */

import { Fragment, useEffect, useRef, useState } from 'react'
import type { FC, MouseEvent } from 'react'
import { useSyncExternalStore } from 'react'
import { MonacoEditorSurface } from '../../editor/EditorSurface.tsx'
import { MonacoDiffEditorSurface } from '../../editor/DiffEditorSurface.tsx'
import type { EditorSurfaceProps } from '../../editor/EditorSurface.tsx'
import { IconChevronRight, IconCircleFilled, IconClose } from '../../theme/codicons.tsx'
import type { FsClient } from '../../fs/client.ts'
import { FsGatewayError } from '../../fs/client.ts'
import { useWorkbench } from '../editor-context.ts'
import type { EditorActions, EditorGroup, EditorState, EditorTab } from '../editor-store.ts'
import type { EngineStoreInstance } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandResource } from '../../platform/commands.ts'
import { ContextMenu } from '../../platform/ContextMenu.tsx'
import { contextMenuEntries } from '../../platform/commands.ts'
import { Sash } from './Sash.tsx'
import { useT } from '../../i18n/I18nProvider.tsx'
import { BreadcrumbsBar } from './BreadcrumbsBar.tsx'
import { extractDocumentSymbols, findEnclosingSymbol } from '../../editor/symbols.ts'

/** Basename of a path, cross-platform. */
function basenameOf(path: string): string {
  return path.split(/[/\\]/u).filter(Boolean).pop() ?? path
}

/** Determine terminal runner command for a file path. */
export function getRunCommandForFile(filepath: string, cwd?: string): string {
  let relPath = filepath.replace(/^[/\\]/u, '')
  if (cwd) {
    const normCwd = cwd.replace(/[/\\]+$/u, '').toLowerCase()
    const normFile = filepath.toLowerCase()
    if (normFile.startsWith(normCwd)) {
      relPath = filepath.slice(cwd.length).replace(/^[/\\]+/u, '')
    }
  }
  const ext = filepath.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'py':
      return `python "${relPath}"`
    case 'js':
    case 'mjs':
    case 'cjs':
      return `node "${relPath}"`
    case 'ts':
    case 'tsx':
      return `npx tsx "${relPath}"`
    case 'sh':
    case 'bash':
      return `bash "${relPath}"`
    case 'rs':
      return 'cargo run'
    case 'go':
      return `go run "${relPath}"`
    case 'html':
      return `start "${relPath}"`
    default:
      return `echo "Running ${relPath}"`
  }
}

/** One group's tab strip plus editor surface or welcome screen. */
function EditorGroupView(props: {
  group: EditorGroup
  editor: EngineStoreInstance<EditorState, EditorActions>
  Surface: FC<EditorSurfaceProps>
  saving: string | undefined
  saveError: string | undefined
  currentCwd?: string | undefined
  onSave: (tab: EditorTab) => void
  onTabContextMenu: (event: MouseEvent, tab: EditorTab) => void
  onEditorContextMenu: (event: MouseEvent, tab: EditorTab) => void
}) {
  const { group, editor, Surface, saving, saveError, currentCwd, onSave, onTabContextMenu, onEditorContextMenu } = props
  const { selectionSink, theme, minimapEnabled, runCommand } = useWorkbench()
  const { t } = useT()
  const active = group.tabs.find(tab => tab.path === group.activePath)
  const editorTheme = theme === 'light' ? 'vs' : 'vs-dark'
  const [currentLine, setCurrentLine] = useState(1)

  const symbols = active ? extractDocumentSymbols(active.content, active.path) : []
  const currentSymbol = findEnclosingSymbol(symbols, currentLine)

  const handleRunActiveFile = () => {
    if (!active) return
    if (active.dirty) {
      onSave(active)
    }
    const runCmd = getRunCommandForFile(active.path, currentCwd)
    ;(globalThis as unknown as { __DSH_PENDING_RUN_COMMAND__?: string }).__DSH_PENDING_RUN_COMMAND__ = runCmd
    window.dispatchEvent(new CustomEvent('dsh:terminal-run-command', { detail: { command: runCmd } }))
  }

  return (
    <div className="dsh-wb-editorgroup">
      <div className="dsh-wb-tabs-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--dsh-wb-editor-group-header-tabs-background)' }}>
        <div
          className="dsh-wb-tabs"
          data-workbench-tabs
          style={{ flex: 1, overflowX: 'auto' }}
          onClick={() => { editor.actions.activateGroup(group.id) }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => {
            event.preventDefault()
            const path = event.dataTransfer.getData('text/plain')
            if (path !== '') editor.actions.moveTab(path, group.id)
          }}
        >
          {group.tabs.map(tab => (
            <button
              key={tab.path}
              type="button"
              className={tab.preview === true ? 'dsh-wb-tab dsh-wb-tab-preview' : 'dsh-wb-tab'}
              aria-selected={tab.path === group.activePath}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', tab.path)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onClick={(event) => {
                event.stopPropagation()
                editor.actions.activate(tab.path)
              }}
              onDoubleClick={(event) => {
                event.stopPropagation()
                editor.actions.pinTab(tab.path)
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  editor.actions.closeTab(tab.path)
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                editor.actions.activate(tab.path)
                onTabContextMenu(event, tab)
              }}
              data-editor-tab={tab.path}
            >
              {tab.dirty && <span className="dsh-wb-tab-dirty"><IconCircleFilled size={9} /></span>}
              <span>{tab.diffTitle ?? (tab.kind === 'diff' ? `${basenameOf(tab.path)} (Diff)` : basenameOf(tab.path))}</span>
              <span
                role="button"
                aria-label={`Close ${basenameOf(tab.path)}`}
                className="dsh-wb-tab-close"
                onClick={(event) => {
                  event.stopPropagation()
                  editor.actions.closeTab(tab.path)
                }}
              >
                <IconClose size={16} />
              </span>
            </button>
          ))}
        </div>
        {active && active.kind !== 'diff' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
            <button
              type="button"
              className="dsh-wb-button dsh-wb-run-button"
              onClick={handleRunActiveFile}
              title={`Run ${basenameOf(active.path)} (F5)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              data-run-file-button
            >
              <span>▶</span>
              <span>Run</span>
            </button>
            <button
              type="button"
              className="dsh-wb-button-secondary dsh-wb-stop-button"
              onClick={() => { window.dispatchEvent(new CustomEvent('dsh:terminal-stop-active')) }}
              title="Stop running process (Shift+F5)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                fontSize: '11px',
                color: 'var(--dsh-wb-errorForeground)',
                cursor: 'pointer',
              }}
              data-stop-file-button
            >
              <span>⏹</span>
              <span>Stop</span>
            </button>
          </div>
        )}
      </div>
      {active && active.kind !== 'diff' && (
        <BreadcrumbsBar
          path={active.path}
          currentSymbol={currentSymbol}
        />
      )}
      {active === undefined
        ? (
          <div className="dsh-wb-welcome" data-editor-welcome>
            <div className="dsh-wb-welcome-title">{t('editor.welcome.title')}</div>
            <div className="dsh-wb-welcome-hint">{t('editor.welcome.hint')}</div>
            <div className="dsh-wb-welcome-shortcuts">
              <div
                className="dsh-wb-welcome-shortcut"
                style={{ cursor: 'pointer' }}
                onClick={() => runCommand?.('workbench.action.files.openFolder')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') runCommand?.('workbench.action.files.openFolder') }}
              >
                <span>{t('explorer.openFolder')}</span>
                <kbd className="dsh-wb-welcome-kbd">Ctrl+O</kbd>
              </div>
              <div
                className="dsh-wb-welcome-shortcut"
                style={{ cursor: 'pointer' }}
                onClick={() => runCommand?.('codeWorkbench.newFile')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') runCommand?.('codeWorkbench.newFile') }}
              >
                <span>{t('explorer.newFile')}</span>
                <kbd className="dsh-wb-welcome-kbd">Ctrl+N</kbd>
              </div>
              <div
                className="dsh-wb-welcome-shortcut"
                style={{ cursor: 'pointer' }}
                onClick={() => runCommand?.('workbench.action.quickOpen')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') runCommand?.('workbench.action.quickOpen') }}
              >
                <span>{t('cmd.quickOpen.title')}</span>
                <kbd className="dsh-wb-welcome-kbd">Ctrl+P</kbd>
              </div>
              <div
                className="dsh-wb-welcome-shortcut"
                style={{ cursor: 'pointer' }}
                onClick={() => runCommand?.('workbench.action.showCommands')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') runCommand?.('workbench.action.showCommands') }}
              >
                <span>{t('cmd.showAllCommands.title')}</span>
                <kbd className="dsh-wb-welcome-kbd">Ctrl+Shift+P</kbd>
              </div>
            </div>
          </div>
        )
        : (
          <div
            className="dsh-wb-editorbody"
            onContextMenu={(event) => {
              event.preventDefault()
              onEditorContextMenu(event, active)
            }}
          >
            {active.kind === 'diff'
              ? (
                <MonacoDiffEditorSurface
                  path={active.path}
                  original={active.originalContent ?? ''}
                  modified={active.content}
                  theme={editorTheme}
                />
              )
              : (
                <Surface
                  path={active.path}
                  content={active.content}
                  language={active.language}
                  theme={editorTheme}
                  minimapEnabled={minimapEnabled ?? true}
                  onChange={(content) => { editor.actions.setContent(active.path, content) }}
                  onSelectionChange={(line, col, text) => {
                    setCurrentLine(line)
                    selectionSink?.({ path: active.path, line, col, text })
                  }}
                />
              )}
            <div className="dsh-wb-editortoolbar">
              <button
                type="button"
                className="dsh-wb-button-secondary"
                disabled={saving === active.path || !active.dirty}
                onClick={() => { onSave(active) }}
                data-editor-save
              >
                {saving === active.path ? t('editor.saving') : t('editor.save')}
              </button>
              <span data-editor-path>{active.diffTitle ?? active.path}</span>
              {saveError !== undefined && <span className="dsh-wb-error" data-editor-error>{saveError}</span>}
            </div>
          </div>
        )}
    </div>
  )
}

export interface EditorAreaProps {
  readonly currentCwd?: string | undefined
}

/** The editor area body: groups plus the dividing sash, save orchestration. */
export function EditorArea({ currentCwd }: EditorAreaProps = {}) {
  const { editor, fs, editorSurface, runCommand, theme } = useWorkbench()
  const { t } = useT()
  const Surface = editorSurface ?? MonacoEditorSurface
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const ratioBaseRef = useRef<number>(50)
  const [saving, setSaving] = useState<string | undefined>()
  const [saveError, setSaveError] = useState<string | undefined>()
  const [conflictPath, setConflictPath] = useState<string | undefined>()
  const [saveAsPath, setSaveAsPath] = useState('')
  // Context menu state: pointer plus the zone the menu was opened from.
  const [menu, setMenu] = useState<{ x: number; y: number; zone: 'editor/title/context' | 'editor/context'; resource: CommandResource } | undefined>()

  // Global F5 shortcut to run active file / Shift+F5 to stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('dsh:terminal-stop-active'))
      } else if (e.key === 'F5') {
        e.preventDefault()
        e.stopPropagation()
        const activeGroup = state.groups.find(g => g.id === state.activeGroupId) ?? state.groups[0]
        const activeTab = activeGroup?.tabs.find(t => t.path === activeGroup.activePath)
        if (activeTab && activeTab.kind !== 'diff') {
          if (activeTab.dirty) void save(activeTab)
          const runCmd = getRunCommandForFile(activeTab.path, currentCwd)
          ;(globalThis as unknown as { __DSH_PENDING_RUN_COMMAND__?: string }).__DSH_PENDING_RUN_COMMAND__ = runCmd
          window.dispatchEvent(new CustomEvent('dsh:terminal-run-command', { detail: { command: runCmd } }))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => { window.removeEventListener('keydown', handleKeyDown, true) }
  }, [state, currentCwd])

  // Auto-sync open non-dirty tabs from disk (AI tool writes, external edits, git ops)
  useEffect(() => {
    let active = true
    const syncOpenTabs = async () => {
      const openTabs = state.groups.flatMap(g => g.tabs).filter(t => !t.dirty && t.kind !== 'diff')
      for (const tab of openTabs) {
        try {
          const file = await fs.readText(tab.path)
          if (!active) return
          if (file.content !== tab.content || file.version !== tab.version) {
            editor.actions.reloadContent(tab.path, file.content, file.version)
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    const timer = setInterval(() => { void syncOpenTabs() }, 1500)
    const onFocus = () => { void syncOpenTabs() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('dsh:fs-change', onFocus)

    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('dsh:fs-change', onFocus)
    }
  }, [state.groups, fs, editor])

  /** Open one zone's menu over a tab (the tab strip already activated it). */
  const openTabMenu = (event: MouseEvent, tab: EditorTab): void => {
    setMenu({ x: event.clientX, y: event.clientY, zone: 'editor/title/context', resource: { path: tab.path, isDirectory: false } })
  }

  /** Open the editor-body menu over the active tab. */
  const openEditorMenu = (event: MouseEvent, tab: EditorTab): void => {
    setMenu({ x: event.clientX, y: event.clientY, zone: 'editor/context', resource: { path: tab.path, isDirectory: false } })
  }

  /** Save one tab through the version guard; stale → conflict dialog. */
  const save = async (tab: EditorTab, overwrite = false): Promise<void> => {
    if (saving !== undefined) return
    setSaving(tab.path)
    setSaveError(undefined)
    setConflictPath(undefined)
    try {
      // The version token from the last read/save guards staleness; a
      // concurrent model-tool write fails this save with FS_STALE_VERSION.
      const result = overwrite
        ? await fs.writeText(tab.path, tab.content)
        : await fs.writeText(tab.path, tab.content, tab.version)
      editor.actions.markSaved(tab.path, result.version)
    } catch (error) {
      if (error instanceof FsGatewayError && error.code === 'FS_STALE_VERSION') {
        setConflictPath(tab.path)
      } else {
        setSaveError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      setSaving(undefined)
    }
  }

  /** Current-tab helpers against the live snapshot. */
  const findTab = (path: string): EditorTab | undefined => state.groups
    .flatMap(group => group.tabs)
    .find(tab => tab.path === path)

  /** Conflict: overwrite the on-disk version with the tab content. */
  const overwriteConflict = async (): Promise<void> => {
    const path = conflictPath
    if (path === undefined) return
    const tab = findTab(path)
    if (tab !== undefined) await save(tab, true)
  }

  /** Conflict: drop local edits, re-read the on-disk version. */
  const discardConflict = async (): Promise<void> => {
    const path = conflictPath
    if (path === undefined) return
    try {
      const file = await fs.readText(path)
      editor.actions.setContent(path, file.content)
      editor.actions.markSaved(path, file.version)
      setConflictPath(undefined)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  /** Conflict: write the tab content to a new path, restore the original. */
  const saveAsConflict = async (): Promise<void> => {
    const path = conflictPath
    const target = saveAsPath.trim()
    if (path === undefined || target === '') return
    const tab = findTab(path)
    if (tab === undefined) return
    try {
      const result = await fs.writeText(target, tab.content)
      editor.actions.openTab({ path: target, content: tab.content, version: result.version, dirty: false, preview: false })
      const original = await fs.readText(path)
      editor.actions.setContent(path, original.content)
      editor.actions.markSaved(path, original.version)
      setConflictPath(undefined)
      setSaveAsPath('')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  // Ctrl+S: the command increments saveRequestSeq; observe and save the
  // active tab (dirty only — a clean tab has nothing to persist).
  const saveSeq = state.saveRequestSeq
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (saveSeq === 0) return
    const group = state.groups.find(candidate => candidate.id === state.activeGroupId)
    const active = group?.tabs.find(tab => tab.path === group.activePath)
    if (active !== undefined && active.dirty) void saveRef.current(active)
  }, [saveSeq])

  // Sash drag converts pixel deltas into a split-ratio change against the
  // container's current extent along the split axis.
  const applyResize = (delta: number): void => {
    const container = containerRef.current
    if (container === null) return
    const extent = state.splitDirection === 'vertical' ? container.clientHeight : container.clientWidth
    if (extent <= 0) return
    editor.actions.setSplitRatio(ratioBaseRef.current + (delta / extent) * 100)
  }

  const focused = state.groups.find(group => group.id === state.activeGroupId)
  const crumbPath = focused?.activePath

  return (
    <div className="dsh-wb-editorarea" data-workbench-editor-area data-split-direction={state.splitDirection ?? 'none'}>
      {crumbPath !== undefined && (
        <div className="dsh-wb-breadcrumbs" data-breadcrumbs data-breadcrumbs-path={crumbPath}>
          {crumbPath.split(/[/\\]/u).filter(Boolean).map((segment, index) => (
            <span key={`${index}-${segment}`} className="dsh-wb-breadcrumb-segment">
              {index > 0 && <IconChevronRight size={14} />}
              <span>{segment}</span>
            </span>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        className="dsh-wb-editorpanes"
        style={{ flexDirection: state.splitDirection === 'vertical' ? 'column' : 'row' }}
      >
        {state.groups.map((group, index) => {
          const share = state.groups.length === 2 ? (index === 0 ? state.splitRatio : 100 - state.splitRatio) : 100
          return (
            <Fragment key={group.id}>
              {index > 0 && (
                <Sash
                  orientation={state.splitDirection === 'vertical' ? 'horizontal' : 'vertical'}
                  label="Resize editor groups"
                  onDragStart={() => { ratioBaseRef.current = state.splitRatio }}
                  onResize={applyResize}
                  onReset={() => { editor.actions.setSplitRatio(50) }}
                />
              )}
              <div
                className="dsh-wb-editorpane"
                style={{ flexGrow: share }}
                data-editor-group={group.id}
                data-editor-group-active={group.id === state.activeGroupId ? 'true' : undefined}
              >
                <EditorGroupView
                  group={group}
                  editor={editor}
                  Surface={Surface}
                  saving={saving}
                  saveError={saveError}
                  currentCwd={currentCwd}
                  onSave={(tab) => { void save(tab) }}
                  onTabContextMenu={openTabMenu}
                  onEditorContextMenu={openEditorMenu}
                />
              </div>
            </Fragment>
          )
        })}
      </div>
      {conflictPath !== undefined && (
        <div className="dsh-wb-conflict" data-editor-conflict data-conflict-path={conflictPath}>
          <div className="dsh-wb-conflict-title">{basenameOf(conflictPath)} {t('editor.conflict.title')}</div>
          <div className="dsh-wb-conflict-body">{t('editor.conflict.body')}</div>
          {saveAsPath !== '' && (
            <input
              className="dsh-wb-input"
              value={saveAsPath}
              onChange={(event) => { setSaveAsPath(event.target.value) }}
              placeholder="/path/to/new/file"
              data-conflict-saveas-input
            />
          )}
          <div className="dsh-wb-conflict-actions">
            <button type="button" className="dsh-wb-button-secondary" onClick={() => { void overwriteConflict() }} data-conflict-overwrite>{t('editor.conflict.overwrite')}</button>
            <button type="button" className="dsh-wb-button-secondary" onClick={() => { void discardConflict() }} data-conflict-discard>{t('editor.conflict.discard')}</button>
            <button
              type="button"
              className="dsh-wb-button-secondary"
              onClick={() => {
                if (saveAsPath === '') setSaveAsPath(conflictPath.replace(basenameOf(conflictPath), ''))
                else void saveAsConflict()
              }}
              data-conflict-saveas
            >
              {saveAsPath === '' ? t('editor.conflict.saveAs') : t('editor.conflict.saveCopy')}
            </button>
            <button type="button" className="dsh-wb-button-secondary" onClick={() => { setConflictPath(undefined); setSaveAsPath('') }} data-conflict-cancel>{t('editor.conflict.cancel')}</button>
          </div>
        </div>
      )}
      {menu !== undefined && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={contextMenuEntries(menu.zone)}
          onRun={(commandId) => { runCommand?.(commandId, menu.resource) }}
          onClose={() => { setMenu(undefined) }}
        />
      )}
    </div>
  )
}
