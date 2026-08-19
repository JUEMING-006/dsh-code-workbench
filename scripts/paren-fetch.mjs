// Parenthesize the async arrow before the type assertion (TS 6 parse fix).
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/terminal/terminal-client.spec.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const from = `  const fetchImpl = async (_url: string, init: { body: string }) => {
    const op = JSON.parse(init.body) as unknown
    sent.push(op)
    return { ok: true, json: async () => respond(op) }
  } as unknown as FetchLike`
const to = `  const fetchImpl = (async (_url: string, init: { body: string }) => {
    const op = JSON.parse(init.body) as unknown
    sent.push(op)
    return { ok: true, json: async () => respond(op) }
  }) as unknown as FetchLike`

if (s.includes(from)) {
  s = s.replace(from, to)
  writeFileSync(p, s)
  console.log('patched')
} else {
  console.log('not-found')
}
