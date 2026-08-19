// One-off type fixes across three files (SearchReplace had intermittent saves).
import { readFileSync, writeFileSync } from 'node:fs'

const fixes = [
  {
    file: '../src/client/editor/EditorSurface.tsx',
    from: 'if (monaco !== null && editor !== null && model !== null) {',
    to: 'if (monaco !== null && editor !== null && model !== undefined && model !== null) {',
  },
  {
    file: '../src/client/tests/regions.client.spec.tsx',
    from: "return { path, entries: [{ name: 'a.txt', type: 'file' }, { name: 'sub', type: 'directory' }] }",
    to: "return { path, entries: [{ name: 'a.txt', type: 'file' as const }, { name: 'sub', type: 'directory' as const }] }",
  },
  {
    file: '../src/client/tests/regions.client.spec.tsx',
    from: "if (path === '/w/sub') return { path, entries: [{ name: 'b.txt', type: 'file' }] }",
    to: "if (path === '/w/sub') return { path, entries: [{ name: 'b.txt', type: 'file' as const }] }",
  },
  {
    file: '../src/host/monaco-static.spec.ts',
    from: 'const response = { status: 0, body: Buffer.alloc(0), type: \'\' }',
    to: 'const response = { status: 0, body: new Uint8Array(0), type: \'\' }',
  },
]

for (const fix of fixes) {
  const p = new URL(fix.file, import.meta.url)
  let s = readFileSync(p, 'utf8')
  if (s.includes(fix.to)) {
    console.log('already:', fix.file)
    continue
  }
  if (!s.includes(fix.from)) {
    console.error('NOT FOUND in', fix.file, ':', fix.from.slice(0, 60))
    continue
  }
  s = s.replace(fix.from, fix.to)
  writeFileSync(p, s)
  console.log('fixed:', fix.file)
}
