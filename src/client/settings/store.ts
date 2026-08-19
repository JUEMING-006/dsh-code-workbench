/**
 * Settings store: persisted user preferences for the workbench (theme, minimap,
 * indent, ...). Each preference lives in localStorage under its own key so they
 * can be changed independently; the workbench reads them at render time.
 */

/** Storage axis the store reads and writes (localStorage in the browser). */
export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Theme preference: 'dark' (default) or 'light'. */
export type ThemePreference = 'dark' | 'light'

/** Indent preference: 2/4/8 spaces or tab. */
export type IndentPreference = 2 | 4 | 8 | 'tab'

/** Theme storage key. */
export const THEME_KEY = 'dsh.workbench.theme'

/** Minimap storage key. */
export const MINIMAP_KEY = 'dsh.workbench.minimap'

/** Indent storage key. */
export const INDENT_KEY = 'dsh.workbench.indent'

/** The default theme. */
export const DEFAULT_THEME: ThemePreference = 'dark'

/** The default minimap state. */
export const DEFAULT_MINIMAP = true

/** The default indent size. */
export const DEFAULT_INDENT: IndentPreference = 2

/** Parse a stored value into a theme preference. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light'
}

/** Parse a stored value into an indent preference. */
export function isIndentPreference(value: unknown): value is IndentPreference {
  return value === 2 || value === 4 || value === 8 || value === 'tab'
}

/** Read the theme preference; absent or malformed means dark. */
export function readTheme(storage: SettingsStorage): ThemePreference {
  const raw = storage.getItem(THEME_KEY)
  return isThemePreference(raw) ? raw : DEFAULT_THEME
}

/** Read the minimap preference; absent or malformed means enabled. */
export function readMinimap(storage: SettingsStorage): boolean {
  const raw = storage.getItem(MINIMAP_KEY)
  return raw === 'false' ? false : true
}

/** Read the indent preference; absent or malformed means 2 spaces. */
export function readIndent(storage: SettingsStorage): IndentPreference {
  const raw = storage.getItem(INDENT_KEY)
  if (raw === '4') return 4
  if (raw === '8') return 8
  if (raw === 'tab') return 'tab'
  return DEFAULT_INDENT
}

/** Persist the theme preference. */
export function writeTheme(storage: SettingsStorage, theme: ThemePreference): void {
  storage.setItem(THEME_KEY, theme)
}

/** Persist the minimap preference. */
export function writeMinimap(storage: SettingsStorage, enabled: boolean): void {
  storage.setItem(MINIMAP_KEY, enabled ? 'true' : 'false')
}

/** Persist the indent preference. */
export function writeIndent(storage: SettingsStorage, indent: IndentPreference): void {
  storage.setItem(INDENT_KEY, indent === 'tab' ? 'tab' : String(indent))
}
