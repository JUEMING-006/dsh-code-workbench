import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReasoningBlock } from './ReasoningBlock.tsx'

describe('ReasoningBlock', () => {
  it('renders reasoning text when expanded', () => {
    render(<ReasoningBlock text="Thought 123" running={false} durationSec={3.5} />)
    expect(screen.getByText('Thought for 3.5s')).toBeDefined()
    // Click header to expand
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Thought 123')).toBeDefined()
  })

  it('renders live thinking indicator when running', () => {
    render(<ReasoningBlock text="Streaming thought" running={true} />)
    expect(screen.getByText('Thinking process...')).toBeDefined()
    expect(screen.getByText('Streaming thought')).toBeDefined()
  })
})
