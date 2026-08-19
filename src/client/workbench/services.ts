/**
 * Workbench services registry: the apply-time service set the shell provides
 * to its regions. The shell needs services that only the plugin body can
 * reach (ctx.sessions, ctx.workspaces), so apply builds the set and the shell
 * reads it from here; standalone renders (tests) provide their own through
 * context instead.
 */

import type { WorkbenchServices } from './editor-context.ts'

let current: WorkbenchServices | null = null

/** Install the apply-time service set (once per plugin load). */
export function installWorkbenchServices(services: WorkbenchServices): void {
  current = services
}

/** Read the installed service set, or null before apply / outside the plugin. */
export function getWorkbenchServices(): WorkbenchServices | null {
  return current
}
