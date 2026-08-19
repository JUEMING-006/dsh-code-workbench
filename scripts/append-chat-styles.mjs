// Appends chat panel styles to styles.ts (SearchReplace intermittent saves).
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/workbench/styles.ts', import.meta.url)
let s = readFileSync(p, 'utf8')
if (s.includes('chatRow')) {
  console.log('already present')
  process.exit(0)
}
const addition = `  chatPanel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    borderBottom: '1px solid var(--ds-color-border, #3c3c3c)',
    flexShrink: 0,
  },
  chatSelect: {
    flex: 1,
    minWidth: 0,
    background: 'var(--ds-color-bg-3, #37373d)',
    color: 'inherit',
    border: '1px solid var(--ds-color-border, #3c3c3c)',
    borderRadius: 4,
    fontSize: 12,
    padding: '2px 4px',
  },
  chatScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '8px 12px',
  },
  chatRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '6px 0',
    borderBottom: '1px solid var(--ds-color-border-subtle, #2d2d2d)',
  },
  chatRole: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ds-color-fg-muted, #858585)',
  },
  chatText: {
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  chatRunning: {
    color: 'var(--ds-color-fg-muted, #858585)',
    fontStyle: 'italic',
  },
  chatComposer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    borderTop: '1px solid var(--ds-color-border, #3c3c3c)',
    flexShrink: 0,
  },
  chatInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid var(--ds-color-border, #3c3c3c)',
    borderRadius: 4,
    background: 'var(--ds-color-bg-3, #37373d)',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 13,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  chatComposerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
} satisfies Record<string, CSSProperties>`
s = s.replace('} satisfies Record<string, CSSProperties>', `${addition}\n`)
writeFileSync(p, s)
console.log('appended chat styles')
