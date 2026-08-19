/**
 * Editor surface tests: language detection and the textarea surface contract
 * (the deterministic stand-in; the Monaco surface itself is exercised in the
 * browser, since jsdom cannot run the editor).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { languageOf, TextareaEditorSurface } from './EditorSurface.tsx'

describe('languageOf', () => {
  it('maps common extensions', () => {
    expect(languageOf('/w/a.ts')).toBe('typescript')
    expect(languageOf('/w/a.tsx')).toBe('typescript')
    expect(languageOf('/w/a.json')).toBe('json')
    expect(languageOf('/w/a.py')).toBe('python')
    expect(languageOf('/w/a.md')).toBe('markdown')
    expect(languageOf('a.go')).toBe('go')
  })

  it('falls back to plaintext for unknown or missing extensions', () => {
    expect(languageOf('/w/README')).toBe('plaintext')
    expect(languageOf('/w/data.xyz')).toBe('plaintext')
  })

  it('is case-insensitive', () => {
    expect(languageOf('/w/A.TS')).toBe('typescript')
  })
})

describe('TextareaEditorSurface', () => {
  it('renders the content and reports edits', () => {
    const onChange = vi.fn()
    render(<TextareaEditorSurface path="/w/a.txt" content="hello" onChange={onChange} />)
    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(input.value).toBe('hello')
    fireEvent.change(input, { target: { value: 'hello world' } })
    expect(onChange).toHaveBeenCalledWith('hello world')
  })

  it('reports the focus-end position and the selected text on selection changes', () => {
    const onSelectionChange = vi.fn()
    render(
      <TextareaEditorSurface
        path="/w/a.txt"
        content={'a\nbc'}
        onChange={vi.fn()}
        onSelectionChange={onSelectionChange}
      />,
    )
    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    input.selectionStart = 2
    input.selectionEnd = 3
    fireEvent.select(input)
    expect(onSelectionChange).toHaveBeenCalledWith(2, 2, 'b')
  })
})
