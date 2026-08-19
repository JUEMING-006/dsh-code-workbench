/**
 * Theme-layer gates: the token table is the single home of color literals in
 * workbench UI code, and the injected stylesheet actually consumes the
 * tokens. These keep future components honest — a stray hex in a part fails
 * here instead of drifting the theme.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLORS, SIZES } from './tokens.ts'
import { WORKBENCH_CSS } from './css.ts'
import { ensureWorkbenchTheme } from './inject.ts'

/** Workbench-mode UI directories the single-source rule covers. */
const SCOPED_DIRS = ['workbench', 'ai', 'editor', 'terminal', 'theme']

/** Recursively collect source file paths under one directory. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/u.test(name) && !/\.spec\./u.test(name) ? [full] : []
  })
}

/** Hex and rgb() color literals (tokens.ts is the sanctioned home). */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/u

describe('design tokens', () => {
  it('carries no color literal outside tokens.ts', () => {
    const offenders: string[] = []
    for (const dir of SCOPED_DIRS) {
      for (const file of sourceFiles(join(import.meta.dirname, '..', dir))) {
        if (file.endsWith(join('theme', 'tokens.ts'))) continue
        const text = readFileSync(file, 'utf8')
        for (const line of text.split('\n')) {
          if (COLOR_LITERAL.test(line)) offenders.push(`${file}: ${line.trim()}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('pins the workbench baseline dimensions', () => {
    // StatusbarPart.HEIGHT, ActivitybarPart.ACTION_HEIGHT, and
    // EditorTabsControl.EDITOR_TAB_HEIGHT.normal at the pinned baseline.
    expect(SIZES.statusBarHeight).toBe(22)
    expect(SIZES.activityBarSize).toBe(48)
    expect(SIZES.tabHeight).toBe(35)
  })

  it('consumes every color token in the stylesheet', () => {
    for (const key of Object.keys(COLORS)) {
      expect(WORKBENCH_CSS).toContain(`--dsh-wb-${key.replace(/\./gu, '-')}:`)
    }
  })

  it('injects the stylesheet once per document', () => {
    ensureWorkbenchTheme(document)
    ensureWorkbenchTheme(document)
    expect(document.querySelectorAll('style[data-dsh-code-workbench-theme]')).toHaveLength(1)
  })
})
