import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CodeBlockView } from './CodeBlockView.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import { createEditorStore } from '../workbench/editor-store.ts'

describe('CodeBlockView', () => {
  it('renders language and code content and supports copy', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    render(
      <WorkbenchContext.Provider value={{ editor: createEditorStore().create() } as never}>
        <CodeBlockView code="console.log('hi')" language="typescript" />
      </WorkbenchContext.Provider>,
    )

    expect(screen.getByText('TypeScript')).toBeDefined()
    expect(screen.getByText("console.log('hi')")).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("console.log('hi')")
  })
})
