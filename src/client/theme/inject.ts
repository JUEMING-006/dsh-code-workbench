/**
 * Theme injection: mounts the workbench stylesheet once per document. The
 * style element carries a stable data attribute so re-mounting the shell (or
 * the plugin registering twice in tests) never duplicates it.
 */

import { WORKBENCH_CSS } from './css.ts'

/** The marker attribute identifying the injected style element. */
const STYLE_ATTRIBUTE = 'data-dsh-code-workbench-theme'

/**
 * Ensure the workbench stylesheet is present.
 * @param doc - the browsing document (injected for testability).
 * @returns the style element (existing or newly appended).
 */
export function ensureWorkbenchTheme(doc: Document): HTMLStyleElement {
  const existing = doc.querySelector<HTMLStyleElement>(`style[${STYLE_ATTRIBUTE}]`)
  if (existing !== null) return existing
  const style = doc.createElement('style')
  style.setAttribute(STYLE_ATTRIBUTE, 'true')
  style.textContent = WORKBENCH_CSS
  doc.head.append(style)
  return style
}
