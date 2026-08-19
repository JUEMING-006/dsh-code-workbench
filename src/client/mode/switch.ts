/**
 * Shell-mode switching: the user-facing verbs behind the status-bar switch.
 * A switch writes the store and reloads — the root-slot shadowing decision
 * is boot-time, so an in-place transition would need a second shell shape
 * the slot machinery does not support.
 */

import { writeMode } from './store.ts'
import type { ModeStorage, ShellMode } from './store.ts'

/** Default page reload (injectable for tests). */
function defaultReload(): void {
  globalThis.location.reload()
}

/**
 * Switch the global shell mode and reload the page.
 * @param storage - the mode storage axis.
 * @param mode - the target mode.
 * @param reload - page reload (defaults to location.reload; injectable for tests).
 */
export function switchMode(storage: ModeStorage, mode: ShellMode, reload: () => void = defaultReload): void {
  writeMode(storage, mode)
  reload()
}
