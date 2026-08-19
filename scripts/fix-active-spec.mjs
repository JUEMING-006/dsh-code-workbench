// Fix active-file spec types (SessionId brand + assertion narrowing).
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/host/active-file.spec.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    "import type { Context } from '@deepseek-ai/cordis'",
    "import type { Context } from '@deepseek-ai/cordis'\nimport { SessionId } from '@deepseek-ai/dsh-session'",
  ],
]
s = s.split("noteActiveFile(ctx, '/w/a.ts', 's1')").join("noteActiveFile(ctx, '/w/a.ts', SessionId('s1'))")
pairs.push([
  'const registered = section.mock.calls[0]![0] as { text: () => string }',
  'const registered = section.mock.calls[0]![0] as unknown as { text: () => string }',
])

for (const [from, to] of pairs) {
  if (s.includes(to)) continue
  if (!s.includes(from)) {
    console.error('NOT FOUND:', from.slice(0, 60))
    continue
  }
  s = s.replace(from, to)
  console.log('patched')
}
writeFileSync(p, s)
