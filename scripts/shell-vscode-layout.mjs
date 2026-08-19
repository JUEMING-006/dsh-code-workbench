// Cleans up the shell (drop the unused selector) and appends menu/status styles.
import { readFileSync, writeFileSync } from 'node:fs'

const shell = new URL('../src/client/workbench/WorkbenchShell.tsx', import.meta.url)
let s = readFileSync(shell, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    `import { memo, useRef, useSyncExternalStore, useState } from 'react'
import type {
  PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'`,
    `import { memo, useRef, useSyncExternalStore, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'`,
  ],
  [
    `import { languageOf } from '../editor/EditorSurface.tsx'
import { WorkbenchContext } from './editor-context.ts'
import type { WorkbenchServices } from './editor-context.ts'
import { createEditorStore } from './editor-store.ts'`,
    `import { languageOf } from '../editor/EditorSurface.tsx'
import { WorkbenchContext } from './editor-context.ts'
import { createEditorStore } from './editor-store.ts'`,
  ],
  [
    `/** Activity-rail entries (VS Code order: explorer first). */
const ACTIVITIES: readonly { id: ActivityId; label: string; Icon: (props: { size?: number }) => React.ReactNode }[] = [`,
    `/** Activity-rail entries (VS Code order: explorer first). */
const ACTIVITIES: readonly { id: ActivityId; label: string; Icon: (props: { size?: number }) => ReactNode }[] = [`,
  ],
  [
    `/** Select the active editor path for the status bar. */
function selectActivePath(state: ReturnType<ReturnType<typeof createEditorStore>['create']> extends never ? never : Parameters<Parameters<WorkbenchServices['editor']['subscribe']>[0]>[0]): string | undefined {
  return state.activePath
}

`,
    '',
  ],
]

for (const [from, to] of pairs) {
  if (s.includes(to)) continue
  if (!s.includes(from)) {
    console.error('SHELL NOT FOUND:', from.slice(0, 60).replaceAll('\n', '\\n'))
    continue
  }
  s = s.replace(from, to)
  console.log('shell patched')
}
writeFileSync(shell, s)

const styles = new URL('../src/client/workbench/styles.ts', import.meta.url)
let t = readFileSync(styles, 'utf8').replaceAll('\r\n', '\n')
if (!t.includes('menuBar')) {
  const addition = `  menuBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    height: 30,
    padding: '0 8px',
    flexShrink: 0,
    background: 'var(--ds-color-bg-2, #252526)',
    borderBottom: '1px solid var(--ds-color-border, #3c3c3c)',
    fontSize: 12,
    userSelect: 'none',
  },
  menuItemWrap: {
    position: 'relative',
  },
  menuButton: {
    padding: '4px 10px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
  },
  menuDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    minWidth: 180,
    padding: '4px 0',
    background: 'var(--ds-color-bg-2, #252526)',
    border: '1px solid var(--ds-color-border, #3c3c3c)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 900,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '5px 14px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'left',
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  statusItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  },
} satisfies Record<string, CSSProperties>`
  t = t.replace('} satisfies Record<string, CSSProperties>', `${addition}\n`)
  writeFileSync(styles, t)
  console.log('styles patched')
}
