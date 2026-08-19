import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownView } from './MarkdownView.tsx'
import { WorkbenchContext } from '../workbench/editor-context.ts'
import { createEditorStore } from '../workbench/editor-store.ts'

describe('MarkdownView', () => {
  it('renders markdown headings, lists, inline formatting and code blocks', () => {
    const md = `### Hello DeepSeek
Here is **bold** text and \`code\`.
- item 1
- item 2

\`\`\`python
print("hello world")
\`\`\`
`

    render(
      <WorkbenchContext.Provider value={{ editor: createEditorStore().create() } as never}>
        <MarkdownView content={md} />
      </WorkbenchContext.Provider>,
    )

    expect(screen.getByText('Hello DeepSeek')).toBeDefined()
    expect(screen.getByText('bold')).toBeDefined()
    expect(screen.getByText('code')).toBeDefined()
    expect(screen.getByText('item 1')).toBeDefined()
    expect(screen.getByText('print("hello world")')).toBeDefined()
  })
})
