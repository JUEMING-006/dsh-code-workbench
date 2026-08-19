/**
 * Panel container: a multi-tab host for the bottom/side panel.
 * Manages a set of registered panel items; each is a React component
 * rendered when its tab is active.
 */

import { useEffect, useState } from 'react'
import type { FC } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '../../i18n/ids.ts'
import { useT } from '../../i18n/I18nProvider.tsx'
import { IconCommentDiscussion, IconError, IconTerminal } from '../../theme/codicons.tsx'
import { TerminalPanel } from '../../terminal/TerminalPanel.tsx'
import { ProblemsPanel } from './ProblemsPanel.tsx'

/** The panel item ids the container knows about. */
export type PanelItemId = 'terminal' | 'problems' | 'output'

/** One registered panel item. */
export interface PanelItem {
  readonly id: PanelItemId
  readonly label: MessageId
  readonly Icon: FC<{ readonly size?: number }>
  readonly Content: FC<{ readonly useSessions: SnapshotSelectorHook<SessionListState>; readonly currentCwd?: string | undefined }>
}

/** Built-in panel roster. */
const BUILTIN_ITEMS: readonly PanelItem[] = [
  {
    id: 'terminal',
    label: 'panel.terminal',
    Icon: IconTerminal,
    Content: TerminalPanel,
  },
  {
    id: 'problems',
    label: 'panel.problems',
    Icon: IconError,
    Content: ProblemsPanel,
  },
  {
    id: 'output',
    label: 'panel.output',
    Icon: IconCommentDiscussion,
    Content: function OutputPlaceholder() {
      const { t } = useT()
      return (
        <div className="dsh-wb-placeholder" data-empty-panel>
          <div>{t('panel.output')}</div>
          <div className="dsh-wb-placeholder-hint">{t('panel.outputHint')}</div>
        </div>
      )
    },
  },
]

/** Composed props the shell delivers. */
export interface PanelContainerProps {
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly currentCwd?: string | undefined
}

/** Default active panel. */
const DEFAULT_PANEL: PanelItemId = 'terminal'

/** The panel container. */
export function PanelContainer({ useSessions, currentCwd }: PanelContainerProps) {
  const [activeId, setActiveId] = useState<PanelItemId>(DEFAULT_PANEL)
  const { t } = useT()

  useEffect(() => {
    const onRun = () => { setActiveId('terminal') }
    window.addEventListener('dsh:terminal-run-command', onRun)
    return () => { window.removeEventListener('dsh:terminal-run-command', onRun) }
  }, [])

  return (
    <>
      <div className="dsh-wb-paneltabs" data-panel-tabs>
        {BUILTIN_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            className={`dsh-wb-paneltab${item.id === activeId ? ' dsh-wb-paneltab-active' : ''}`}
            aria-selected={item.id === activeId}
            onClick={() => { setActiveId(item.id) }}
            data-panel-tab={item.id}
          >
            <item.Icon size={14} />
            <span>{t(item.label)}</span>
          </button>
        ))}
      </div>
      <div className="dsh-wb-panelbody" data-panel-body>
        {BUILTIN_ITEMS.map(item => (
          <div
            key={item.id}
            style={{
              display: item.id === activeId ? 'flex' : 'none',
              width: '100%',
              height: '100%',
              flexDirection: 'column',
            }}
          >
            <item.Content useSessions={useSessions} currentCwd={currentCwd} />
          </div>
        ))}
      </div>
    </>
  )
}
