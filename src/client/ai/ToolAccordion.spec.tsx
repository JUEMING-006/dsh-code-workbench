import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToolAccordion } from './ToolAccordion.tsx'

describe('ToolAccordion', () => {
  it('renders command summary and details on expand', () => {
    render(
      <ToolAccordion
        name="bash"
        argsRaw='{"command":"pnpm test"}'
        result="all tests passed"
        status="success"
      />,
    )

    expect(screen.getByText(/Run Command: pnpm test/u)).toBeDefined()

    // Expand
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('pnpm test')).toBeDefined()
    expect(screen.getByText('all tests passed')).toBeDefined()
  })
})
