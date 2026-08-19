/**
 * Code Block View: rendered code snippets in AI responses.
 * Provides copy, insert-at-cursor, and apply-to-file action buttons.
 */

import { useState } from 'react'
import { IconCheck, IconCopy, IconNewFile } from '../theme/codicons.tsx'
import { useWorkbench } from '../workbench/editor-context.ts'
import { languageLabelOf } from '../editor/EditorSurface.tsx'

export interface CodeBlockViewProps {
  readonly code: string
  readonly language?: string | undefined
  readonly filePath?: string | undefined
}

export function CodeBlockView({ code, language, filePath }: CodeBlockViewProps) {
  const [copied, setCopied] = useState(false)
  const workbench = useWorkbench()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2000)
    } catch {
      // Ignore clipboard failure in restricted browser context
    }
  }

  const insertAtCursor = () => {
    const editorStore = workbench.editor
    const state = editorStore.getSnapshot()
    const activeGroup = state.groups.find(g => g.id === state.activeGroupId)
    const activePath = activeGroup?.activePath
    if (activePath === undefined) return
    const activeTab = activeGroup?.tabs.find(t => t.path === activePath)
    if (activeTab === undefined) return
    // Append or replace content
    const nextContent = activeTab.content + (activeTab.content.endsWith('\n') ? '' : '\n') + code
    editorStore.actions.setContent(activePath, nextContent)
  }

  const langLabel = language ? languageLabelOf(language) : filePath ? filePath.split(/[/\\]/u).pop() : 'Code'

  return (
    <div className="dsh-wb-ai-code-block" data-code-block>
      <div className="dsh-wb-ai-code-header">
        <span className="dsh-wb-ai-code-lang">{langLabel}</span>
        <div className="dsh-wb-ai-code-actions">
          <button
            type="button"
            className="dsh-wb-ai-code-btn"
            title="Insert into active editor"
            onClick={insertAtCursor}
            data-code-insert
          >
            <IconNewFile size={13} />
            <span>Insert</span>
          </button>
          <button
            type="button"
            className="dsh-wb-ai-code-btn"
            title="Copy code"
            onClick={() => { void copy() }}
            data-code-copy
          >
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="dsh-wb-ai-code-content">
        <code>{code}</code>
      </pre>
    </div>
  )
}
