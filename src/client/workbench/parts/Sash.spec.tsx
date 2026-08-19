/**
 * Sash tests: drag reports signed deltas from the drag start, the base is
 * captured per drag, and double-click resets.
 */
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sash } from './Sash.tsx'

function pointerProps(x: number, y: number): Partial<React.PointerEvent> {
  return { clientX: x, clientY: y, button: 0 }
}

describe('Sash', () => {
  it('reports signed drag deltas from the drag start', () => {
    const onResize = vi.fn()
    const { getByRole } = render(
      <Sash orientation="vertical" label="Resize" onDragStart={() => {}} onResize={onResize} onReset={() => {}} />,
    )
    fireEvent.pointerDown(getByRole('separator'), pointerProps(100, 0))
    fireEvent.pointerMove(window, pointerProps(140, 0))
    expect(onResize).toHaveBeenCalledWith(40)
    fireEvent.pointerMove(window, pointerProps(70, 0))
    expect(onResize).toHaveBeenCalledWith(-30)
  })

  it('captures a fresh base for each drag', () => {
    const onDragStart = vi.fn()
    const onResize = vi.fn()
    const { getByRole } = render(
      <Sash orientation="horizontal" label="Resize" onDragStart={onDragStart} onResize={onResize} onReset={() => {}} />,
    )
    fireEvent.pointerDown(getByRole('separator'), pointerProps(0, 100))
    fireEvent.pointerUp(window)
    fireEvent.pointerDown(getByRole('separator'), pointerProps(0, 200))
    fireEvent.pointerMove(window, pointerProps(0, 190))
    expect(onDragStart).toHaveBeenCalledTimes(2)
    expect(onResize).toHaveBeenCalledWith(-10)
  })

  it('stops reporting after pointer up', () => {
    const onResize = vi.fn()
    const { getByRole } = render(
      <Sash orientation="vertical" label="Resize" onDragStart={() => {}} onResize={onResize} onReset={() => {}} />,
    )
    fireEvent.pointerDown(getByRole('separator'), pointerProps(0, 0))
    fireEvent.pointerUp(window)
    fireEvent.pointerMove(window, pointerProps(500, 0))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('resets on double click', () => {
    const onReset = vi.fn()
    const { getByRole } = render(
      <Sash orientation="vertical" label="Resize" onDragStart={() => {}} onResize={() => {}} onReset={onReset} />,
    )
    fireEvent.doubleClick(getByRole('separator'))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
