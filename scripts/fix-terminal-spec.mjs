// Switch the terminal spec to the FetchLike seam.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/terminal/terminal-client.spec.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    "import { createTerminalClient, type EventSourceLike } from './terminal-client.ts'",
    "import { createTerminalClient, type EventSourceLike, type FetchLike } from './terminal-client.ts'",
  ],
  ['  } as unknown as typeof globalThis.fetch', '  } as unknown as FetchLike'],
]
for (const [from, to] of pairs) {
  if (s.includes(from)) {
    s = s.replace(from, to)
    console.log('ok:', from.slice(0, 50))
  } else {
    console.log('miss:', from.slice(0, 50))
  }
}
writeFileSync(p, s)
