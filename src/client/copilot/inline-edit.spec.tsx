/**
 * Unit tests for InlineEditWidget (Cursor-style Ctrl+K inline edit).
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InlineEditWidget } from './InlineEditWidget.tsx'

describe('InlineEditWidget', () => {
  it('renders input, handles user submit and calls onAccept', async () => {
    const onAccept = vi.fn()
    const onClose = vi.fn()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        replacement: 'def minmax(items):\n    return min(items), max(items)',
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    render(
      <InlineEditWidget
        top={100}
        left={50}
        width={800}
        selectedCode="def minmax(): pass"
        startLine={5}
        endLine={5}
        path="main.py"
        language="python"
        documentText="print('start')\ndef minmax(): pass\nprint('end')"
        selectionStartOffset={15}
        selectionEndOffset={33}
        onAccept={onAccept}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('✨ Inline Edit')).toBeDefined()
    expect(screen.getByText('L5 · 1 line')).toBeDefined()

    const input = screen.getByPlaceholderText(/Describe changes/u)
    fireEvent.change(input, { target: { value: 'Implement real minmax' } })

    const generateBtn = screen.getByRole('button', { name: 'Generate' })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByText(/Preview proposed replacement/u)).toBeDefined()
    })

    const acceptBtn = screen.getByRole('button', { name: /✓ Accept/u })
    fireEvent.click(acceptBtn)

    expect(onAccept).toHaveBeenCalledWith('def minmax(items):\n    return min(items), max(items)')
  })

  it('closes on Escape key press or reject button click', () => {
    const onAccept = vi.fn()
    const onClose = vi.fn()

    const { container } = render(
      <InlineEditWidget
        top={100}
        left={50}
        width={800}
        selectedCode="x = 1"
        startLine={1}
        endLine={1}
        path="main.py"
        documentText="x = 1"
        selectionStartOffset={0}
        selectionEndOffset={5}
        onAccept={onAccept}
        onClose={onClose}
      />,
    )

    const widget = container.querySelector('.dsh-wb-inline-edit-widget')!
    fireEvent.keyDown(widget, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
