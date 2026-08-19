/**
 * Mode toggle button tests: labels, target derivation, and the click flow
 * against the browser store (jsdom localStorage) with a reload double.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GLOBAL_MODE_KEY } from './store.ts'
import { ModeToggleButton, targetMode, toggleLabel } from './ModeToggleButton.tsx'

describe('mode toggle button', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('derives labels and targets', () => {
    expect(toggleLabel('harness')).toBe('Open Code Mode')
    expect(toggleLabel('workbench')).toBe('Exit Code Mode')
    expect(targetMode('harness')).toBe('workbench')
    expect(targetMode('workbench')).toBe('harness')
  })

  it('offers the code-mode switch from the harness default', () => {
    render(<ModeToggleButton />)
    expect(screen.getByRole('button', { name: 'Open Code Mode' })).toBeTruthy()
  })

  it('writes the target mode and reloads on click', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<ModeToggleButton />)
    fireEvent.click(screen.getByRole('button'))
    expect(window.localStorage.getItem(GLOBAL_MODE_KEY)).toBe('workbench')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('switches back from code mode', () => {
    window.localStorage.setItem(GLOBAL_MODE_KEY, 'workbench')
    render(<ModeToggleButton />)
    expect(screen.getByRole('button', { name: 'Exit Code Mode' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(window.localStorage.getItem(GLOBAL_MODE_KEY)).toBe('harness')
  })
})
