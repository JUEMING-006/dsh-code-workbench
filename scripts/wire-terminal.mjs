// Wires the terminal into services, styles, and the panel slot.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  {
    path: '../src/client/workbench/editor-context.ts',
    pairs: [
      {
        from: "import type { EditorSurfaceProps } from '../editor/EditorSurface.tsx'",
        to: "import type { EditorSurfaceProps } from '../editor/EditorSurface.tsx'\nimport type { TerminalClient } from '../terminal/terminal-client.ts'",
      },
      {
        from: `  /**
   * The editor body surface. Defaults to the Monaco surface; tests inject
   * the deterministic textarea stand-in.
   */
  readonly editorSurface?: FC<EditorSurfaceProps>
}`,
        to: `  /**
   * The editor body surface. Defaults to the Monaco surface; tests inject
   * the deterministic textarea stand-in.
   */
  readonly editorSurface?: FC<EditorSurfaceProps>
  /** Terminal gateway client (the bottom panel; absent in standalone renders). */
  readonly terminal?: TerminalClient
}`,
      },
    ],
  },
  {
    path: '../src/client/workbench/styles.ts',
    pairs: [
      {
        from: '} satisfies Record<string, CSSProperties>',
        to: `  terminalPanel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  terminalBody: {
    flex: 1,
    minHeight: 0,
    padding: '4px 0 0 8px',
    overflow: 'hidden',
  },
  terminalToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 12px',
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>`,
      },
    ],
  },
  {
    path: '../src/client/apply.ts',
    pairs: [
      {
        from: "import { createFsClient } from './fs/client.ts'",
        to: "import { createFsClient } from './fs/client.ts'\nimport { createTerminalClient } from './terminal/terminal-client.ts'",
      },
      {
        from: "import { SidebarContent } from './workbench/parts/SidebarContent.tsx'",
        to: "import { SidebarContent } from './workbench/parts/SidebarContent.tsx'\nimport { TerminalPanel } from './terminal/TerminalPanel.tsx'",
      },
      {
        from: `    sessions: ctx.sessions as unknown as WorkbenchSessions,
    workspaces: ctx.workspaces as unknown as WorkbenchWorkspaces,
  })`,
        to: `    sessions: ctx.sessions as unknown as WorkbenchSessions,
    workspaces: ctx.workspaces as unknown as WorkbenchWorkspaces,
    terminal: createTerminalClient(),
  })`,
      },
      {
        from: "      ctx.slots.register({ name: 'workbench.editor' }, EditorArea),",
        to: `      ctx.slots.register({ name: 'workbench.editor' }, EditorArea),
      ctx.slots.register({ name: 'workbench.panel' }, TerminalPanel),`,
      },
    ],
  },
  {
    path: '../src/client/terminal/TerminalPanel.tsx',
    pairs: [
      {
        from: `export function TerminalPanel({ useSessions }: TerminalPanelProps) {
  const { terminal } = useWorkbench()`,
        to: `export function TerminalPanel({ useSessions }: TerminalPanelProps) {
  const services = useWorkbench()
  const terminal = services.terminal`,
      },
    ],
  },
]

for (const file of files) {
  const p = new URL(file.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  for (const { from, to } of file.pairs) {
    if (s.includes(to)) continue
    if (!s.includes(from)) {
      console.error('NOT FOUND in', file.path, ':', from.slice(0, 60).replaceAll('\n', '\\n'))
      continue
    }
    s = s.replace(from, to)
    console.log('patched:', file.path)
  }
  writeFileSync(p, s)
}
