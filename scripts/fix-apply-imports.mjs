// Fix apply imports: ui-layout type face (shell.overlay SlotMap) + toggle.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/apply.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    `import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the client Context merge (ctx.slots) and the built-in
// 'root' SlotMap declaration into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { createFsClient } from './fs/client.ts'
import { createTerminalClient } from './terminal/terminal-client.ts'
import { readGlobalMode } from './mode/store.ts'`,
    `import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the client Context merge (ctx.slots) and the built-in
// 'root' SlotMap declaration into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: brings the shell.overlay SlotMap declaration (owned by the
// harness layout package) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { createFsClient } from './fs/client.ts'
import { createTerminalClient } from './terminal/terminal-client.ts'
import { ModeToggleButton } from './mode/ModeToggleButton.tsx'
import { readGlobalMode } from './mode/store.ts'`,
  ],
]

for (const [from, to] of pairs) {
  if (s.includes(to)) continue
  if (!s.includes(from)) {
    console.error('NOT FOUND:', from.slice(0, 70).replaceAll('\n', '\\n'))
    continue
  }
  s = s.replace(from, to)
  console.log('patched')
}
writeFileSync(p, s)
