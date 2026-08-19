// ReactNode import + panel header + editor welcome + styles.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  {
    path: '../src/client/workbench/parts/SidebarContent.tsx',
    pairs: [
      [
        `import { useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'`,
        `import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'`,
      ],
      ['  let body: React.ReactNode', '  let body: ReactNode'],
    ],
  },
  {
    path: '../src/client/terminal/TerminalPanel.tsx',
    pairs: [
      [
        `  return (
    <div style={WB.terminalPanel} data-terminal-panel>
      <div style={WB.label}>Terminal</div>
      <div ref={hostRef} style={WB.terminalBody} data-terminal-host />`,
        `  return (
    <div style={WB.terminalPanel} data-terminal-panel>
      <div style={WB.panelHeader} data-panel-header>
        <span style={WB.label}>TERMINAL</span>
        <button
          type="button"
          style={WB.sidebarHeaderAction}
          title="Close Panel"
          aria-label="Close Panel"
          onClick={() => { services.panelActions?.togglePanel() }}
          data-panel-close
        >
          ×
        </button>
      </div>
      <div ref={hostRef} style={WB.terminalBody} data-terminal-host />`,
      ],
    ],
  },
  {
    path: '../src/client/workbench/parts/EditorArea.tsx',
    pairs: [
      [
        `      {active === undefined
        ? <div style={WB.placeholder}>Open a file from the explorer to start editing</div>
        : (`,
        `      {active === undefined
        ? (
          <div style={WB.welcome} data-editor-welcome>
            <div style={WB.welcomeTitle}>Welcome to Code Mode</div>
            <div style={WB.welcomeHint}>Open a file from the Explorer on the left to start editing.</div>
          </div>
        )
        : (`,
      ],
    ],
  },
]

for (const file of files) {
  const p = new URL(file.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  for (const [from, to] of file.pairs) {
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

const styles = new URL('../src/client/workbench/styles.ts', import.meta.url)
let t = readFileSync(styles, 'utf8').replaceAll('\r\n', '\n')
if (!t.includes('sidebarHeader')) {
  const addition = `  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px 0 12px',
    borderBottom: '1px solid var(--ds-color-border, #3c3c3c)',
    flexShrink: 0,
    height: 34,
  },
  sidebarHeaderAction: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px 0 12px',
    borderBottom: '1px solid var(--ds-color-border, #3c3c3c)',
    flexShrink: 0,
    height: 30,
  },
  welcome: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: '100%',
    padding: '0 32px',
    textAlign: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 300,
    color: 'var(--ds-color-fg, #cccccc)',
  },
  welcomeHint: {
    fontSize: 13,
    color: 'var(--ds-color-fg-muted, #858585)',
    maxWidth: 420,
    lineHeight: 1.6,
  },
} satisfies Record<string, CSSProperties>`
  t = t.replace('} satisfies Record<string, CSSProperties>', `${addition}\n`)
  writeFileSync(styles, t)
  console.log('styles patched')
}
