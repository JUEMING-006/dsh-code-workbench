/**
 * Qoder-style Context Bar:
 * Displays context chips for active editor file and text selections,
 * allowing developers to manage context sent to the AI assistant.
 */

import { IconClose, IconFileCode } from '../theme/codicons.tsx'
import type { EditorSelection } from '../workbench/editor-context.ts'

export interface ContextBarProps {
  readonly activePath?: string | undefined
  readonly attachedSelection?: EditorSelection | undefined
  readonly onRemoveSelection: () => void
  readonly includeActiveFile: boolean
  readonly onToggleActiveFile: () => void
}

export function ContextBar({
  activePath,
  attachedSelection,
  onRemoveSelection,
  includeActiveFile,
  onToggleActiveFile,
}: ContextBarProps) {
  if (activePath === undefined && attachedSelection === undefined) return null

  const activeFilename = activePath ? activePath.split(/[/\\]/u).pop() ?? activePath : ''

  return (
    <div className="dsh-wb-ai-context-bar" data-context-bar>
      {activePath && (
        <div
          className={`dsh-wb-ai-context-chip${includeActiveFile ? ' dsh-wb-ai-context-active' : ''}`}
          title={includeActiveFile ? 'Active file attached (Click to remove)' : 'Click to attach active file'}
          onClick={onToggleActiveFile}
          data-context-active-file
        >
          <IconFileCode size={13} />
          <span className="dsh-wb-ai-context-label">{activeFilename}</span>
          {includeActiveFile && (
            <span className="dsh-wb-ai-context-badge">Active</span>
          )}
        </div>
      )}
      {attachedSelection && (
        <div className="dsh-wb-ai-context-chip dsh-wb-ai-context-active" data-chat-attach data-context-selection>
          <span className="dsh-wb-ai-context-label">
            {attachedSelection.path}:{attachedSelection.line}:{attachedSelection.col}
          </span>
          <button
            type="button"
            className="dsh-wb-ai-context-remove"
            title="Remove attached selection"
            aria-label="Remove attached selection"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveSelection()
            }}
            data-chat-attach-remove
          >
            <IconClose size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
