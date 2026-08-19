/**
 * Active-file model awareness: the workbench tells the host which file the
 * user is viewing, the host records it durably (log-only `editor/active`
 * session event) and surfaces it to the model through a dynamic system-prompt
 * section on every assembly.
 *
 * Model-visible means logged: the section text is per-request derived from
 * the active-file fact, and that fact is appended to the session log when an
 * agent is live — a request and its "user is viewing" context stay
 * reconstructable from one log.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    /**
     * The workbench user switched their active editor file. Log-only: it
     * never reaches model history by itself, but it is the durable fact
     * behind the model-visible active-file prompt section.
     */
    'editor/active': { path: string }
  }
}

/** The current active-file fact (undefined until the workbench reports one). */
export interface ActiveFileFact {
  readonly path: string
  readonly sessionId: SessionId | undefined
}

let active: ActiveFileFact | undefined

/** Read the current active-file fact (section provider and diagnostics). */
export function getActiveFile(): ActiveFileFact | undefined {
  return active
}

/**
 * Record the workbench's active file and persist the fact as a log-only
 * session event when the owning agent is live.
 * @param ctx - root context carrying the agent registry.
 * @param path - the active file path.
 * @param sessionId - the workbench session, when one is current.
 */
export function noteActiveFile(ctx: Context, path: string, sessionId: SessionId | undefined): void {
  active = { path, sessionId }
  if (sessionId === undefined) return
  const agent = ctx.agents.get(sessionId)
  if (agent === undefined) return
  try {
    // Log-only append: no turn is opened, persistence drains at checkpoints.
    agent.session.append('editor/active', { path })
  } catch (error) {
    ctx.logger.warn(`code-workbench: editor/active append failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** The prompt section name the active-file fact renders under. */
export const ACTIVE_FILE_SECTION = 'workbench:active-file'

/** Section order: after the persona (0), before tool guidance (100+). */
const ACTIVE_FILE_ORDER = 60

/**
 * Register the active-file prompt section: one dynamic line naming the file
 * the user is viewing, or nothing when the workbench reported none.
 * @param ctx - root context carrying systemPrompt.
 * @returns the section disposer.
 */
export function installActiveFileSection(ctx: Context): () => void {
  return ctx.systemPrompt.section({
    name: ACTIVE_FILE_SECTION,
    order: ACTIVE_FILE_ORDER,
    text: () => {
      const fact = getActiveFile()
      return fact === undefined ? '' : `The user is currently viewing: ${fact.path}`
    },
  })
}
