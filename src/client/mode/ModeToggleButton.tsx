/**
 * Floating mode toggle: the harness-mode entry point into code mode.
 *
 * Registered into `shell.overlay` — the harness frame's additive floating
 * layer, the documented surface for external surfaces that float over the
 * app. In harness mode the frame renders it pinned to the top-right; in
 * workbench mode the frame stops rendering (the workbench shadows the root),
 * so this affordance naturally disappears and the workbench's own status-bar
 * switch takes over.
 */

import type { CSSProperties } from 'react'
import { readGlobalMode, writeMode } from './store.ts'
import type { ShellMode } from './store.ts'

/** Visible styling: high-contrast pill pinned to the top-right of the page. */
const BUTTON_STYLE: CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 16,
  zIndex: 1000,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  border: '1px solid rgba(127, 127, 127, 0.5)',
  borderRadius: 999,
  background: 'rgba(40, 40, 46, 0.92)',
  color: '#e6e6e6',
  fontFamily: 'var(--ds-font-ui, system-ui, sans-serif)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
  // The overlay layer is click-through until an entry opts into pointer
  // events; the button must.
  pointerEvents: 'auto',
}

/** The label the button shows for its target mode. */
export function toggleLabel(mode: ShellMode): string {
  return mode === 'workbench' ? 'Exit Code Mode' : 'Open Code Mode'
}

/** The mode the button switches to. */
export function targetMode(mode: ShellMode): ShellMode {
  return mode === 'workbench' ? 'harness' : 'workbench'
}

/**
 * The floating toggle body. Reads the current mode from the browser store at
 * render; the click writes the target mode and reloads the page (the shell
 * shape is a boot-time decision).
 */
export function ModeToggleButton() {
  const current = readGlobalMode(globalThis.localStorage)
  return (
    <button
      type="button"
      style={BUTTON_STYLE}
      data-mode-toggle
      onClick={() => {
        writeMode(globalThis.localStorage, targetMode(current))
        globalThis.location.reload()
      }}
    >
      {toggleLabel(current)}
    </button>
  )
}
