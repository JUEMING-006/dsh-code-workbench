import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContextBar } from './ContextBar.tsx'

describe('ContextBar', () => {
  it('renders active file chip and selection chip', () => {
    const onRemoveSelection = vi.fn()
    const onToggleActiveFile = vi.fn()

    render(
      <ContextBar
        activePath="src/main.py"
        attachedSelection={{ path: 'src/main.py', line: 10, col: 1, text: 'hello' }}
        onRemoveSelection={onRemoveSelection}
        includeActiveFile={true}
        onToggleActiveFile={onToggleActiveFile}
      />,
    )

    expect(screen.getByText('main.py')).toBeDefined()
    expect(screen.getByText('src/main.py:10:1')).toBeDefined()

    fireEvent.click(screen.getByTitle('Remove attached selection'))
    expect(onRemoveSelection).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Active file attached (Click to remove)'))
    expect(onToggleActiveFile).toHaveBeenCalled()
  })
})
