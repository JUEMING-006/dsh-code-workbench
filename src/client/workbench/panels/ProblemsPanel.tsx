import { memo, useEffect, useState } from 'react'
import { loadMonaco } from '../../editor/load-monaco.ts'
import { useWorkbench } from '../editor-context.ts'
import { IconError, IconWarning, IconCommentDiscussion } from '../../theme/codicons.tsx'
import { FileIcon } from '../parts/FileIcon.tsx'

export interface ProblemItem {
  readonly id: string
  readonly path: string
  readonly message: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly line: number
  readonly column: number
}

export const ProblemsPanel = memo(function ProblemsPanel() {
  const { editor } = useWorkbench()
  const [problems, setProblems] = useState<ProblemItem[]>([])

  useEffect(() => {
    let disposed = false
    void loadMonaco().then((monaco) => {
      if (disposed) return
      const updateMarkers = () => {
        const markers = monaco.editor.getModelMarkers({})
        const items: ProblemItem[] = markers.map((m, idx) => ({
          id: `${m.resource.path}-${m.startLineNumber}-${m.startColumn}-${idx}`,
          path: m.resource.path.replace(/^\//u, ''),
          message: m.message,
          severity: m.severity === 8 /* MarkerSeverity.Error */ ? 'error' : m.severity === 4 /* MarkerSeverity.Warning */ ? 'warning' : 'info',
          line: m.startLineNumber,
          column: m.startColumn,
        }))
        setProblems(items)
      }

      updateMarkers()
      const disposable = monaco.editor.onDidChangeMarkers(() => {
        updateMarkers()
      })

      return () => {
        disposable.dispose()
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  const handleProblemClick = (problem: ProblemItem) => {
    editor.actions.openTab(problem.path)
    window.dispatchEvent(
      new CustomEvent('dsh:navigate-to-position', {
        detail: { path: problem.path, line: problem.line, column: problem.column },
      }),
    )
  }

  const errorCount = problems.filter(p => p.severity === 'error').length
  const warningCount = problems.filter(p => p.severity === 'warning').length

  if (problems.length === 0) {
    return (
      <div
        className="dsh-wb-placeholder"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          opacity: 0.7,
          fontSize: '12px',
          gap: '6px',
        }}
        data-empty-problems
      >
        <div>No problems have been detected in the workspace.</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>Syntax errors and diagnostics will appear here automatically.</div>
      </div>
    )
  }

  return (
    <div
      className="dsh-wb-problems-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontSize: '12px',
        color: 'var(--dsh-wb-foreground)',
      }}
      data-problems-list
    >
      {/* Summary Header */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '6px 12px',
          borderBottom: '1px solid var(--dsh-wb-panel-border)',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--dsh-wb-error-foreground)' }}>
          <IconError size={13} /> {errorCount} Error{errorCount !== 1 ? 's' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--dsh-wb-description-foreground)' }}>
          <IconWarning size={13} /> {warningCount} Warning{warningCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Problem Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {problems.map(p => (
          <div
            key={p.id}
            className="dsh-wb-problem-item"
            onClick={() => handleProblemClick(p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid var(--dsh-wb-panel-border)',
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter') handleProblemClick(p)
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {p.severity === 'error' ? (
                <span style={{ color: 'var(--dsh-wb-error-foreground)' }}><IconError size={14} /></span>
              ) : p.severity === 'warning' ? (
                <span style={{ color: 'var(--dsh-wb-description-foreground)' }}><IconWarning size={14} /></span>
              ) : (
                <span><IconCommentDiscussion size={14} /></span>
              )}
              <span style={{ fontFamily: 'var(--dsh-wb-font-mono, monospace)', fontSize: '11px' }}>{p.message}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.6, fontSize: '11px' }}>
              <FileIcon path={p.path} isDirectory={false} size={12} />
              <span>{p.path} [{p.line}, {p.column}]</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
