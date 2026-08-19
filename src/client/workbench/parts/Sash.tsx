/**
 * Sash: the draggable divider between two workbench regions.
 * Pointer-down starts a drag tracked on window listeners (no
 * Pointer Capture API dependency, so jsdom can drive it too); the owner
 * receives signed pixel deltas from the drag start; double-click resets the
 * region to its default size.
 */

import { useRef } from 'react'

/** Props for one sash. */
export interface SashProps {
  /** Divider orientation: vertical sash separates left/right neighbors. */
  readonly orientation: 'vertical' | 'horizontal'
  /** Accessible name of the boundary this sash resizes. */
  readonly label: string
  /** Drag began: capture the owning region's size before deltas arrive. */
  readonly onDragStart: () => void
  /**
   * Apply one drag step: signed pixels since drag start (positive = widen
   * the region on the leading side).
   */
  readonly onResize: (delta: number) => void
  /** Reset the region to its default size (double-click). */
  readonly onReset: () => void
}

/** The sash divider. */
export function Sash({ orientation, label, onDragStart, onResize, onReset }: SashProps) {
  const dragStartRef = useRef<number | undefined>(undefined)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const start = orientation === 'vertical' ? event.clientX : event.clientY
    dragStartRef.current = start
    onDragStart()
    const onMove = (move: PointerEvent): void => {
      if (dragStartRef.current === undefined) return
      const current = orientation === 'vertical' ? move.clientX : move.clientY
      onResize(current - dragStartRef.current)
    }
    const onUp = (): void => {
      dragStartRef.current = undefined
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`dsh-wb-sash dsh-wb-sash-${orientation}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
    />
  )
}
