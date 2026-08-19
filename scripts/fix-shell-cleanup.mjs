// Restore the WorkbenchServices import and drop the leftover selector.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/workbench/WorkbenchShell.tsx', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const importFrom = `import { WorkbenchContext } from './editor-context.ts'
import { createEditorStore } from './editor-store.ts'`
const importTo = `import { WorkbenchContext } from './editor-context.ts'
import type { WorkbenchServices } from './editor-context.ts'
import { createEditorStore } from './editor-store.ts'`
if (s.includes(importFrom) && !s.includes(importTo)) {
  s = s.replace(importFrom, importTo)
  console.log('import restored')
}

const marker = '/** Select the active editor path for the status bar. */'
const start = s.indexOf(marker)
if (start >= 0) {
  const end = s.indexOf('}', start)
  if (end >= 0) {
    s = s.slice(0, start) + s.slice(end + 2)
    console.log('selector dropped')
  }
}
writeFileSync(p, s)
