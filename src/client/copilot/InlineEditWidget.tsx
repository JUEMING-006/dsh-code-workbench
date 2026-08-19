/**
 * Inline AI Code Edit Widget (Cursor-style Ctrl+K):
 * Floats directly near the selected code in Monaco Editor, providing an
 * interactive prompt input, streaming/generation state, diff review, and
 * Ctrl+Enter to accept or Escape to reject.
 */

import { memo, useEffect, useRef, useState } from 'react'
import { INLINE_EDIT_ROUTE_PATH } from '../../shared/fs-contract.ts'
import type { InlineEditRequest, InlineEditResponse } from '../../shared/fs-contract.ts'

export interface InlineEditWidgetProps {
  /** Visible coordinate positions within the editor container. */
  readonly top: number
  readonly left: number
  readonly width: number
  /** The code currently selected by the user. */
  readonly selectedCode: string
  /** 1-based start and end line numbers of the selection. */
  readonly startLine: number
  readonly endLine: number
  /** File path and language context. */
  readonly path: string
  readonly language?: string | undefined
  /** Full document text for context extraction. */
  readonly documentText: string
  /** Offset of the selection within document. */
  readonly selectionStartOffset: number
  readonly selectionEndOffset: number
  /** User accepted the replacement code. */
  readonly onAccept: (replacement: string) => void
  /** User cancelled / closed the widget. */
  readonly onClose: () => void
}

export const InlineEditWidget = memo(function InlineEditWidget({
  top,
  left,
  width,
  selectedCode,
  startLine,
  endLine,
  path,
  language,
  documentText,
  selectionStartOffset,
  selectionEndOffset,
  onAccept,
  onClose,
}: InlineEditWidgetProps) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [replacement, setReplacement] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const lineCount = Math.max(1, endLine - startLine + 1)
  const selectionSummary = `L${startLine}${endLine > startLine ? `-L${endLine}` : ''} · ${lineCount} line${lineCount > 1 ? 's' : ''}`

  const handleGenerate = async (promptText = instruction): Promise<void> => {
    const trimmed = promptText.trim()
    if (trimmed.length === 0 || loading) return

    setLoading(true)
    setError(undefined)

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const prefix = documentText.slice(0, selectionStartOffset)
    const suffix = documentText.slice(selectionEndOffset)

    const request: InlineEditRequest = {
      instruction: trimmed,
      selectedCode,
      prefix,
      suffix,
      path,
      language,
    }

    try {
      const response = await fetch(INLINE_EDIT_ROUTE_PATH, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const text = await response.text()
        setError(`Error ${response.status}: ${text}`)
        setLoading(false)
        return
      }

      const data = await response.json() as InlineEditResponse
      if (!data.ok || data.replacement === undefined) {
        setError(data.ok ? 'Empty response' : (data as { message?: string }).message ?? 'Generation failed')
      } else {
        setReplacement(data.replacement)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      if (replacement !== undefined) {
        onAccept(replacement)
      } else {
        void handleGenerate()
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      void handleGenerate()
    }
  }

  return (
    <div
      className="dsh-wb-inline-edit-widget"
      style={{
        position: 'absolute',
        top: Math.max(10, top),
        left: Math.max(20, Math.min(left, width - 420)),
        width: 440,
        zIndex: 50,
        backgroundColor: 'var(--dsh-wb-bg-elevated, #252526)',
        border: '1px solid var(--dsh-wb-accent, #007acc)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        fontSize: '12px',
        color: 'var(--dsh-wb-fg, #cccccc)',
        fontFamily: 'inherit',
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.85, fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--dsh-wb-accent, #007acc)' }}>
          <span>✨ Inline Edit</span>
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', color: 'inherit' }}>
            {selectionSummary}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', fontSize: '10px', opacity: 0.7 }}>
          <span>Esc to cancel</span>
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="Describe changes (e.g. 'Add docstring', 'Make async', 'Optimize loop')..."
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: 'var(--dsh-wb-bg-input, #1e1e1e)',
            color: 'inherit',
            border: '1px solid var(--dsh-wb-border, #3c3c3c)',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="dsh-wb-button"
          onClick={() => void handleGenerate()}
          disabled={loading || instruction.trim().length === 0}
          style={{
            backgroundColor: 'var(--dsh-wb-accent, #007acc)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: loading || instruction.trim().length === 0 ? 'not-allowed' : 'pointer',
            opacity: loading || instruction.trim().length === 0 ? 0.6 : 1,
            fontWeight: 500,
          }}
        >
          {loading ? 'Thinking...' : 'Generate'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ color: '#f48771', fontSize: '11px', backgroundColor: 'rgba(244, 135, 113, 0.1)', padding: '4px 8px', borderRadius: '3px' }}>
          {error}
        </div>
      )}

      {/* Replacement Preview & Accept / Reject bar */}
      {replacement !== undefined && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px' }}>
          <div style={{ fontSize: '11px', opacity: 0.75 }}>Preview proposed replacement:</div>
          <pre
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              padding: '6px 8px',
              borderRadius: '4px',
              margin: 0,
              fontSize: '11px',
              fontFamily: 'monospace',
              borderLeft: '3px solid #89d185',
              color: '#9cdcfe',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {replacement}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              className="dsh-wb-button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--dsh-wb-border, #3c3c3c)',
                color: 'inherit',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              ✗ Reject (Esc)
            </button>
            <button
              type="button"
              className="dsh-wb-button"
              onClick={() => onAccept(replacement)}
              style={{
                backgroundColor: '#2ea043',
                border: 'none',
                color: '#ffffff',
                borderRadius: '4px',
                padding: '4px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓ Accept (Ctrl+Enter)
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
