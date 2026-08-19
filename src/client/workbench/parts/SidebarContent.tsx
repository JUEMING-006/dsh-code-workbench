/**
 * Sidebar content: the single workbench.sidebar occupant that switches its
 * body by the active activity-rail entry, under a VS Code-style view header
 * (title + actions). The AI assistant lives in the auxiliary bar
 * (AuxBarContent), not here.
 */

import { useSyncExternalStore, useState } from 'react'
import type { ReactNode } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { ActivityId } from '../geometry.ts'
import type { MessageId } from '../../i18n/ids.ts'
import { useWorkbench } from '../editor-context.ts'
import { IconEllipsis, IconFolderOpened, IconNewFile, IconNewFolder, IconRefresh } from '../../theme/codicons.tsx'
import { openFileIntoEditor } from '../open-file.ts'
import { FilesView } from './FilesView.tsx'
import { SearchView } from './SearchView.tsx'
import { SettingsView } from './SettingsView.tsx'
import { SourceControlView } from './SourceControlView.tsx'
import { AiPanel } from '../../ai/AiPanel.tsx'
import { useT } from '../../i18n/I18nProvider.tsx'

/** Composed props the sidebar entry receives (root scope standard kit + owner). */
export interface SidebarContentProps {
  /** Activity-rail selection decided by the shell. */
  readonly activity: ActivityId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  /** Explorer-mutation counter from the shell: each bump remounts the tree. */
  readonly fsOpsSeq: number
  /** Last explorer-mutation failure surfaced by the shell. */
  readonly explorerError: string | undefined
  /** Current effective workspace directory. */
  readonly currentCwd?: string | undefined
}

/** View titles per activity (VS Code view-header convention). */
const TITLES: Record<ActivityId, MessageId> = {
  files: 'explorer.title',
  search: 'search.title',
  ai: 'activity.aiAssistant',
  settings: 'settings.title',
  scm: 'activity.scm',
  run: 'activity.run',
  extensions: 'activity.extensions',
}

/** Empty-state body for activities that have no panel yet. */
function Placeholder({ label }: { readonly label: string }) {
  return <div className="dsh-wb-placeholder">{label}</div>
}

/** Empty-state card for activities without an implemented panel. */
function EmptyActivityCard({ label, hint }: { readonly label: string; readonly hint: string }) {
  return (
    <div className="dsh-wb-placeholder" data-empty-activity>
      <div>{label}</div>
      <div className="dsh-wb-placeholder-hint">{hint}</div>
    </div>
  )
}

/** The workbench sidebar body under its view header. */
export function SidebarContent({ activity, useSessions, fsOpsSeq, explorerError, currentCwd: propCwd }: SidebarContentProps) {
  const { editor, fs, git, runCommand } = useWorkbench()
  const { t } = useT()
  const sessionCwd = useSessions(state => state.current !== undefined ? state.byId[state.current]?.cwd : undefined)
  const currentCwd = propCwd ?? sessionCwd
  const [openError, setOpenError] = useState<string | undefined>()
  const [treeEpoch, setTreeEpoch] = useState(0)
  const editorState = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const activeGroup = editorState.groups.find(group => group.id === editorState.activeGroupId)

  const openFile = async (path: string): Promise<void> => {
    try {
      await openFileIntoEditor(fs, editor, path)
      setOpenError(undefined)
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : String(error))
    }
  }

  let body: ReactNode
  if (activity === 'files') {
    body = currentCwd === undefined
      ? (
        <div className="dsh-wb-placeholder" style={{ flexDirection: 'column', gap: '12px' }}>
          <div>{t('explorer.noWorkspace')}</div>
          <button
            type="button"
            className="dsh-wb-button"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { runCommand?.('workbench.action.files.openFolder') }}
          >
            {t('explorer.openFolder')}
          </button>
        </div>
      )
      : (
        <>
          <FilesView
            key={`${treeEpoch}:${fsOpsSeq}`}
            fs={fs}
            root={currentCwd}
            activePath={activeGroup?.activePath}
            onOpenFile={(path) => { void openFile(path) }}
          />
          {openError !== undefined && <div className="dsh-wb-error">{openError}</div>}
        </>
      )
  } else if (activity === 'search' && currentCwd !== undefined) {
    body = (
      <SearchView
        fs={fs}
        root={currentCwd}
        onOpenFile={(path) => { void openFile(path) }}
      />
    )
  } else if (activity === 'search') {
    body = <div className="dsh-wb-placeholder">{t('search.noWorkspace')}</div>
  } else if (activity === 'ai') {
    body = <AiPanel useSessions={useSessions} currentCwd={currentCwd} />
  } else if (activity === 'settings') {
    body = <SettingsView useSessions={useSessions} />
  } else if (activity === 'scm' && currentCwd !== undefined && git !== undefined) {
    body = <SourceControlView git={git} root={currentCwd} />
  } else if (activity === 'scm') {
    body = <EmptyActivityCard label={t('activity.scm')} hint="需要 Git 仓库与工作区才能使用源代码管理" />
  } else if (activity === 'run') {
    body = <EmptyActivityCard label={t('activity.run')} hint="测试提供方尚未接入" />
  } else if (activity === 'extensions') {
    body = <EmptyActivityCard label={t('activity.extensions')} hint="扩展系统范围外" />
  } else {
    body = <Placeholder label={activity} />
  }

  return (
    <>
      <div className="dsh-wb-viewheader" data-sidebar-header>
        <span className="dsh-wb-viewheader-title">{t(TITLES[activity])}</span>
        <div className="dsh-wb-viewheader-actions">
          {activity === 'files' && (
            <>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title={t('explorer.openFolder')}
                aria-label={t('explorer.openFolder')}
                onClick={() => { runCommand?.('workbench.action.files.openFolder') }}
                data-explorer-open-folder
              >
                <IconFolderOpened />
              </button>
              {currentCwd !== undefined && (
                <>
                  <button
                    type="button"
                    className="dsh-wb-actionicon"
                    title={t('explorer.newFile')}
                    aria-label={t('explorer.newFile')}
                    onClick={() => { runCommand?.('codeWorkbench.newFile', { path: currentCwd, isDirectory: true }) }}
                    data-explorer-new-file
                  >
                    <IconNewFile />
                  </button>
                  <button
                    type="button"
                    className="dsh-wb-actionicon"
                    title={t('explorer.newFolder')}
                    aria-label={t('explorer.newFolder')}
                    onClick={() => { runCommand?.('codeWorkbench.newFolder', { path: currentCwd, isDirectory: true }) }}
                    data-explorer-new-folder
                  >
                    <IconNewFolder />
                  </button>
                  <button
                    type="button"
                    className="dsh-wb-actionicon"
                    title={t('explorer.refresh')}
                    aria-label={t('explorer.refresh')}
                    onClick={() => { setTreeEpoch(epoch => epoch + 1) }}
                    data-explorer-refresh
                  >
                    <IconRefresh />
                  </button>
                </>
              )}
            </>
          )}
          <button
            type="button"
            className="dsh-wb-actionicon"
            title={t('common.viewsAndMoreActions')}
            aria-label={t('common.viewsAndMoreActions')}
            data-sidebar-more
          >
            <IconEllipsis />
          </button>
        </div>
      </div>
      {explorerError !== undefined && <div className="dsh-wb-error" data-explorer-error>{explorerError}</div>}
      {body}
    </>
  )
}
