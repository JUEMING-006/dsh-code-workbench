// Adds the panel-actions slice to WorkbenchServices.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/workbench/editor-context.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    `/** The workspaces verbs the workbench calls (host IWorkspaces slice). */
export interface WorkbenchWorkspaces {
  /** The New Session flow on the current or recent workspace. */
  startSession(): void
}`,
    `/** The workspaces verbs the workbench calls (host IWorkspaces slice). */
export interface WorkbenchWorkspaces {
  /** The New Session flow on the current or recent workspace. */
  startSession(): void
}

/** Geometry verbs regions may trigger (the shell's baked store actions). */
export interface PanelActions {
  togglePanel(): void
  toggleSidebar(): void
}`,
  ],
  [
    `  /** Terminal gateway client (the bottom panel; absent in standalone renders). */
  readonly terminal?: TerminalClient
}`,
    `  /** Terminal gateway client (the bottom panel; absent in standalone renders). */
  readonly terminal?: TerminalClient
  /** Geometry verbs (filled by the shell at render time; panel headers use them). */
  panelActions?: PanelActions
}`,
  ],
]

for (const [from, to] of pairs) {
  if (s.includes(to)) continue
  if (!s.includes(from)) {
    console.error('NOT FOUND:', from.slice(0, 60).replaceAll('\n', '\\n'))
    continue
  }
  s = s.replace(from, to)
  console.log('patched')
}
writeFileSync(p, s)
