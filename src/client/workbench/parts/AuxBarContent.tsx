/**
 * Auxiliary bar content: the AI assistant's view container, docked in the
 * auxiliary bar by default. The view is mobile (P4): its header carries a
 * move-to menu (auxiliary / sidebar / panel / floating) that re-docks the
 * view through the shell's panel actions, and the close button hides the
 * auxiliary bar at home or recalls the view there from any other dock.
 */

import { useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { AiErrorBoundary, AiPanel } from '../../ai/AiPanel.tsx'
import { useWorkbench } from '../editor-context.ts'
import { IconClose, IconEllipsis } from '../../theme/codicons.tsx'
import type { AiLocation } from '../geometry.ts'

/** Composed props the aux-bar entry receives (root scope standard kit). */
export interface AuxBarContentProps {
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly currentCwd?: string | undefined
}

/** Move-to menu targets, in dock order. */
const AI_LOCATIONS: readonly { id: AiLocation; label: string }[] = [
  { id: 'auxiliary', label: 'Auxiliary Bar' },
  { id: 'sidebar', label: 'Side Bar' },
  { id: 'panel', label: 'Panel' },
  { id: 'floating', label: 'Floating Window' },
]

/** The AI assistant's view container: header over the assistant panel. */
export function AuxBarContent({ useSessions, currentCwd }: AuxBarContentProps) {
  const services = useWorkbench()
  // Standalone renders have no shell layout hook: default to the home dock.
  const aiLocation = services.useLayout?.(state => state.aiLocation) ?? 'auxiliary'
  const [moveOpen, setMoveOpen] = useState(false)
  return (
    <>
      <div className="dsh-wb-viewheader" data-view-header="aux">
        <span className="dsh-wb-viewheader-title">AI Assistant</span>
        <div className="dsh-wb-viewheader-actions">
          <div className="dsh-wb-viewheader-menuwrap">
            <button
              type="button"
              className="dsh-wb-actionicon"
              title="Move AI Assistant"
              aria-label="Move AI Assistant"
              onClick={() => { setMoveOpen(open => !open) }}
              data-ai-move-toggle
            >
              <IconEllipsis />
            </button>
            {moveOpen && (
              <div className="dsh-wb-viewheader-dropdown" data-ai-move-menu>
                {AI_LOCATIONS.map(target => (
                  <button
                    key={target.id}
                    type="button"
                    className="dsh-wb-menu-entry"
                    aria-pressed={aiLocation === target.id}
                    onClick={() => {
                      services.panelActions?.moveAiTo(target.id)
                      setMoveOpen(false)
                    }}
                    data-ai-move={target.id}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="dsh-wb-actionicon"
            title={aiLocation === 'auxiliary' ? 'Close Auxiliary Bar' : 'Return to Auxiliary Bar'}
            aria-label={aiLocation === 'auxiliary' ? 'Close Auxiliary Bar' : 'Return to Auxiliary Bar'}
            onClick={() => {
              if (aiLocation === 'auxiliary') services.panelActions?.toggleAuxBar()
              else services.panelActions?.moveAiTo('auxiliary')
            }}
            data-aux-close
          >
            <IconClose />
          </button>
        </div>
      </div>
      <AiErrorBoundary>
        <AiPanel useSessions={useSessions} currentCwd={currentCwd} />
      </AiErrorBoundary>
    </>
  )
}
