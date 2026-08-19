/**
 * Context menu: the shared right-click surface for the explorer tree, editor
 * tabs, editor body, and chat panel. Opens at the pointer, flips inside the
 * viewport when it would overflow an edge, and closes on Escape, an outside
 * click, or after a command runs. Entries come from the command table
 * (contextMenuEntries) — the menu only labels and dispatches, regions wire
 * the semantics through their runCommand.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ContextMenuEntry } from './commands.ts'
import { useT } from '../i18n/I18nProvider.tsx'
import type { MessageId } from '../i18n/ids.ts'

/** Props: the pointer position plus the resolved zone entries. */
export interface ContextMenuProps {
  readonly x: number
  readonly y: number
  readonly entries: readonly ContextMenuEntry[]
  /** Dispatch one command id (the region closes the menu itself). */
  readonly onRun: (commandId: string) => void
  readonly onClose: () => void
}

/** Gap kept between the menu and the viewport edge. */
const EDGE_GAP = 4

/** The right-click menu surface. */
export function ContextMenu({ x, y, entries, onRun, onClose }: ContextMenuProps) {
  const { t } = useT()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // The menu renders first at the pointer; once measured, flip the side that
  // would overflow the viewport (entries changes re-measure: the menu size
  // changed with them).
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (menu === null) return
    const rect = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(0, Math.min(x, window.innerWidth - rect.width - EDGE_GAP)),
      top: Math.max(0, Math.min(y, window.innerHeight - rect.height - EDGE_GAP)),
    })
  }, [x, y, entries])

  // Escape closes from anywhere; the caller owns the state so it just
  // receives onClose.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  return (
    <div
      className="dsh-wb-contextmenu-backdrop"
      data-context-menu-backdrop
      onMouseDown={onClose}
      onContextMenu={(event) => {
        // A second right-click elsewhere closes instead of chaining menus.
        event.preventDefault()
        onClose()
      }}
    >
      <div
        ref={menuRef}
        className="dsh-wb-contextmenu"
        style={position}
        role="menu"
        data-context-menu
        onMouseDown={(event) => { event.stopPropagation() }}
        onContextMenu={(event) => { event.stopPropagation() }}
      >
        {entries.map(entry => (
          <button
            key={entry.commandId}
            type="button"
            role="menuitem"
            className={entry.danger ? 'dsh-wb-contextmenu-entry dsh-wb-contextmenu-danger' : 'dsh-wb-contextmenu-entry'}
            onClick={() => {
              onRun(entry.commandId)
              onClose()
            }}
            data-context-menu-entry={entry.commandId}
          >
            {t(entry.label as MessageId)}
          </button>
        ))}
      </div>
    </div>
  )
}
