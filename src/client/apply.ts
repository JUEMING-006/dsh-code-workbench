/**
 * Client plugin body: the boot-time mode decision and the conditional root
 * registration.
 *
 * One contribution is unconditional: the floating mode toggle, registered
 * into the harness frame's shell.overlay layer — the harness page's entry
 * point into code mode. In harness mode the frame renders it; in workbench
 * mode the frame stops rendering (the workbench shadows the root), so the
 * affordance disappears and the workbench's own status-bar switch takes
 * over.
 *
 * The workbench shell itself registers only in code mode, into the built-in
 * root slot with an explicit lower shadowing priority than the harness
 * AppFrame (priority -1 < its default 0), so the workbench wins the root
 * cell and the harness shell stops rendering. A workbench render crash
 * abdicates in the other direction: the harness shell takes over
 * automatically. (Static roster plugins get no automatic priority — the
 * page-local rank the cordis-client-runner guard assigns applies to dynamic
 * packages only — so the shadowing priority must be explicit.)
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the client Context merge (ctx.slots) and the built-in
// 'root' SlotMap declaration into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: brings the shell.overlay SlotMap declaration (owned by the
// harness layout package) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { createFsClient, createFsOpsClient } from './fs/client.ts'
import { createGitClient } from './git/client.ts'
import { createTerminalClient } from './terminal/terminal-client.ts'
import { ModeToggleButton } from './mode/ModeToggleButton.tsx'
import { readGlobalMode } from './mode/store.ts'
import { createEditorStore } from './workbench/editor-store.ts'
import type { WorkbenchSessions, WorkbenchWorkspaces } from './workbench/editor-context.ts'
import { createWorkbenchStore } from './workbench/geometry.ts'
import { EditorArea } from './workbench/parts/EditorArea.tsx'
import { AuxBarContent } from './workbench/parts/AuxBarContent.tsx'
import { SidebarContent } from './workbench/parts/SidebarContent.tsx'
import { PanelContainer } from './workbench/panels/PanelContainer.tsx'
import { installWorkbenchServices } from './workbench/services.ts'
import { ensureWorkbenchTheme } from './theme/inject.ts'
import { WORKBENCH_CHILDREN } from './workbench/slots.ts'
import { WorkbenchShell } from './workbench/WorkbenchShell.tsx'

/** Required services: the slot registry plus the sessions/workspaces faces (all provided by client-runtime). */
export const inject = ['slots', 'sessions', 'workspaces']

/** Stable plugin name surfaced in diagnostics. */
export const name = 'code-workbench'

/**
 * Browser plugin body.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  // The harness-mode entry point, registered unconditionally: in workbench
  // mode the frame stops rendering the overlay layer, so the button simply
  // ceases to exist there.
  ctx.effect(
    () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'code-workbench-mode-toggle',
      order: 10,
    }, ModeToggleButton),
    'code-workbench: floating mode toggle',
  )
  if (readGlobalMode(globalThis.localStorage) !== 'workbench') return
  // The workbench stylesheet mounts with the shell (idempotent per document).
  ctx.effect(() => {
    const style = ensureWorkbenchTheme(document)
    return () => { style.remove() }
  }, 'code-workbench: theme stylesheet')
  // The service set the shell provides to its regions. Built here because
  // the host service faces (sessions/workspaces) are only reachable from a
  // plugin body, not from a pure slot component.
  installWorkbenchServices({
    editor: createEditorStore().create(),
    fs: createFsClient(),
    fsOps: createFsOpsClient(),
    // Narrow plugin-owned slices of the host faces (see editor-context).
    sessions: ctx.sessions as unknown as WorkbenchSessions,
    workspaces: ctx.workspaces as unknown as WorkbenchWorkspaces,
    terminal: createTerminalClient(),
    git: createGitClient(),
  })
  ctx.effect(() => {
    const disposers: Array<() => void> = [
      // The shell first: its children declaration creates the region slots
      // the content registrations below contribute into.
      ctx.slots.register({
        name: 'root',
        // Static roster plugins register at default priority 0 unless this
        // explicit shadowing rank is given (lowest renders).
        priority: -1,
        children: WORKBENCH_CHILDREN,
        store: createWorkbenchStore,
      }, WorkbenchShell),
      ctx.slots.register({ name: 'workbench.sidebar' }, SidebarContent),
      ctx.slots.register({ name: 'workbench.auxbar' }, AuxBarContent),
      ctx.slots.register({ name: 'workbench.editor' }, EditorArea),
      ctx.slots.register({ name: 'workbench.panel' }, PanelContainer),
    ]
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'code-workbench: shadow root with the workbench shell')
}
