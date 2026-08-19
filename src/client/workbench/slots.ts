/**
 * Workbench slot declarations: the five regions the workbench shell renders
 * under the root slot. Every key is new to the SlotMap — the plugin never
 * touches the harness layout's declared children (sidebar/conversation/
 * details), which is what makes shadowing the root slot safe: the harness
 * contributions stay mounted and merely stop rendering while the workbench
 * wins the root cell.
 */

import type { SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import type { ActivityId } from './geometry.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Leftmost icon rail: files, search, settings (AI toggles the aux bar). */
    'workbench.activitybar': { kind: 'single'; scope: 'root' }
    /** Primary sidebar context panel; content follows the activity rail. */
    'workbench.sidebar': {
      kind: 'single'
      scope: 'root'
      owner: {
        activity: ActivityId
        fsOpsSeq: number
        explorerError: string | undefined
        currentCwd?: string | undefined
      }
    }
    /** Auxiliary (right-hand) bar: the AI assistant view container. */
    'workbench.auxbar': { kind: 'single'; scope: 'root' }
    /** Editor area: tab strip plus the active editor or view. */
    'workbench.editor': { kind: 'single'; scope: 'root' }
    /** Bottom panel: terminal, output, problems. */
    'workbench.panel': { kind: 'single'; scope: 'root' }
    /** Bottom status strip contributions. */
    'workbench.statusbar': { kind: 'list'; scope: 'root' }
  }
}

/** The children table the workbench shell registers with the root slot. */
export const WORKBENCH_CHILDREN = {
  'workbench.activitybar': { kind: 'single', scope: 'root' },
  'workbench.sidebar': { kind: 'single', scope: 'root' },
  'workbench.auxbar': { kind: 'single', scope: 'root' },
  'workbench.editor': { kind: 'single', scope: 'root' },
  'workbench.panel': { kind: 'single', scope: 'root' },
  'workbench.statusbar': { kind: 'list', scope: 'root' },
} as const
