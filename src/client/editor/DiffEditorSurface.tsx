/**
 * Monaco Diff Editor Surface: renders side-by-side or inline diff for Git
 * changes and AI modifications.
 */

import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { languageOf } from './EditorSurface.tsx'
import { loadMonaco } from './load-monaco.ts'

export interface DiffEditorSurfaceProps {
  readonly path: string
  readonly original: string
  readonly modified: string
  readonly theme?: 'vs-dark' | 'vs' | 'hc-black'
  readonly readOnly?: boolean
  readonly renderSideBySide?: boolean
}

export function MonacoDiffEditorSurface({
  path,
  original,
  modified,
  theme = 'vs-dark',
  readOnly = true,
  renderSideBySide = true,
}: DiffEditorSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const diffEditorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    let disposed = false
    let origModel: Monaco.editor.ITextModel | null = null
    let modModel: Monaco.editor.ITextModel | null = null

    void loadMonaco().then((monaco) => {
      if (disposed || hostRef.current === null) return
      const lang = languageOf(path)
      origModel = monaco.editor.createModel(original, lang)
      modModel = monaco.editor.createModel(modified, lang)

      const diffEditor = monaco.editor.createDiffEditor(hostRef.current, {
        theme,
        readOnly,
        renderSideBySide,
        automaticLayout: true,
        fontSize: 13,
        scrollBeyondLastLine: false,
      })
      diffEditor.setModel({ original: origModel, modified: modModel })
      diffEditorRef.current = diffEditor
    })

    return () => {
      disposed = true
      diffEditorRef.current?.dispose()
      origModel?.dispose()
      modModel?.dispose()
      diffEditorRef.current = null
    }
  }, [path, original, modified, theme, readOnly, renderSideBySide])

  return (
    <div
      ref={hostRef}
      className="dsh-wb-diff-surface"
      data-diff-surface
      style={{ width: '100%', height: '100%' }}
    >
      {/* Test / headless fallback */}
      <div className="dsh-wb-diff-fallback" style={{ display: 'none' }}>
        <pre data-diff-original>{original}</pre>
        <pre data-diff-modified>{modified}</pre>
      </div>
    </div>
  )
}
