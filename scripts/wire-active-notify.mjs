// EditorArea: report the active tab to the host; tests pass the sessions stub.
import { readFileSync, writeFileSync } from 'node:fs'

const jobs = [
  {
    path: '../src/client/workbench/parts/EditorArea.tsx',
    pairs: [
      {
        from: `import { useState } from 'react'
import { useSyncExternalStore } from 'react'
import { MonacoEditorSurface } from '../../editor/EditorSurface.tsx'
import { useWorkbench } from '../editor-context.ts'
import { WB } from '../styles.ts'`,
        to: `import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { MonacoEditorSurface } from '../../editor/EditorSurface.tsx'
import { useWorkbench } from '../editor-context.ts'
import { WB } from '../styles.ts'`,
      },
      {
        from: `/** The editor area body. */
export function EditorArea() {
  const { editor, fs, editorSurface } = useWorkbench()
  const Surface = editorSurface ?? MonacoEditorSurface
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const active = state.tabs.find(tab => tab.path === state.activePath)`,
        to: `/** Composed props the editor entry receives (root scope standard kit). */
export interface EditorAreaProps {
  readonly useSessions: SnapshotSelectorHook<SessionListState>
}

/** The editor area body. */
export function EditorArea({ useSessions }: EditorAreaProps) {
  const { editor, fs, editorSurface } = useWorkbench()
  const Surface = editorSurface ?? MonacoEditorSurface
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const active = state.tabs.find(tab => tab.path === state.activePath)
  const currentSessionId = useSessions(s => s.current)

  // Model-visible context: report the active file to the host on every tab
  // switch (the host logs the fact and surfaces it in prompt assembly).
  useEffect(() => {
    if (active !== undefined) {
      void fs.noteActiveFile(active.path, currentSessionId).catch(() => {})
    }
  }, [active, currentSessionId, fs])`,
      },
    ],
  },
  {
    path: '../src/client/tests/regions.client.spec.tsx',
    pairs: [
      {
        from: `    const utils = render(
      <WorkbenchContext.Provider value={{ editor, fs, editorSurface, sessions, workspaces }}>
        <EditorArea />
      </WorkbenchContext.Provider>,
    )`,
        to: `    const utils = render(
      <WorkbenchContext.Provider value={{ editor, fs, editorSurface, sessions, workspaces }}>
        <EditorArea useSessions={useSessionsStub} />
      </WorkbenchContext.Provider>,
    )`,
      },
    ],
  },
]

for (const job of jobs) {
  const p = new URL(job.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  for (const { from, to } of job.pairs) {
    if (s.includes(to)) continue
    if (!s.includes(from)) {
      console.error('NOT FOUND in', job.path, ':', from.slice(0, 60).replaceAll('\n', '\\n'))
      continue
    }
    s = s.replace(from, to)
    console.log('patched:', job.path)
  }
  writeFileSync(p, s)
}
