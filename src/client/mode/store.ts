/**
 * Shell-mode store: the browser-side switch between the default harness
 * three-column layout and the code-mode workbench.
 *
 * A mode change never takes effect in place: the shadowing decision (whether
 * this plugin registers the root slot) happens once at boot, so switching
 * writes the store and reloads the page. The store keeps a global default
 * plus an optional per-session override; the per-session override is additive
 * and removing it falls back to the global value.
 */

/** The two shell shapes a dsh web page can boot. */
export type ShellMode = 'harness' | 'workbench'

/** Storage axis the store reads and writes (localStorage in the browser). */
export interface ModeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Global default mode key. */
export const GLOBAL_MODE_KEY = 'dsh.workbench.mode'

/** Per-session override key prefix (suffix is the session id). */
export const SESSION_MODE_PREFIX = 'dsh.workbench.mode.session.'

/** The default mode of an unconfigured installation: the harness layout. */
export const DEFAULT_MODE: ShellMode = 'harness'

/** Parse a stored value into a mode, rejecting anything unknown as harness. */
export function isShellMode(value: unknown): value is ShellMode {
  return value === 'harness' || value === 'workbench'
}

/** Read the global mode; an absent or malformed value means harness. */
export function readGlobalMode(storage: ModeStorage): ShellMode {
  const raw = storage.getItem(GLOBAL_MODE_KEY)
  return isShellMode(raw) ? raw : DEFAULT_MODE
}

/** Read the effective mode for one session: session override wins, else global. */
export function readMode(storage: ModeStorage, sessionId?: string): ShellMode {
  if (sessionId !== undefined) {
    const raw = storage.getItem(`${SESSION_MODE_PREFIX}${sessionId}`)
    if (isShellMode(raw)) return raw
  }
  return readGlobalMode(storage)
}

/**
 * Persist a mode. With a session id the value is a per-session override;
 * without one it replaces the global default. Writing the global default to
 * its own value is a no-op-ish replace (harmless idempotent write).
 */
export function writeMode(storage: ModeStorage, mode: ShellMode, sessionId?: string): void {
  const key = sessionId === undefined ? GLOBAL_MODE_KEY : `${SESSION_MODE_PREFIX}${sessionId}`
  storage.setItem(key, mode)
}

/** Remove one session's override, falling back to the global default. */
export function clearSessionMode(storage: ModeStorage, sessionId: string): void {
  storage.removeItem(`${SESSION_MODE_PREFIX}${sessionId}`)
}
