// Parse-op narrowing + test stub fixes.
import { readFileSync, writeFileSync } from 'node:fs'

const jobs = [
  {
    path: '../src/host/fs-gateway.ts',
    from: "if (candidate.op !== 'listDir' && candidate.op !== 'readText' && candidate.op !== 'writeText') {",
    to: "if (candidate.op !== 'listDir' && candidate.op !== 'readText' && candidate.op !== 'writeText' && candidate.op !== 'noteActiveFile') {",
  },
  {
    path: '../src/client/tests/regions.client.spec.tsx',
    from: "    writeText: vi.fn(async (path: string) => ({ path, version: 'v9' })),",
    to: "    writeText: vi.fn(async (path: string) => ({ path, version: 'v9' })),\n    noteActiveFile: vi.fn(async () => {}),",
  },
]

for (const job of jobs) {
  const p = new URL(job.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  if (s.includes(job.to)) {
    console.log('already:', job.path)
    continue
  }
  if (!s.includes(job.from)) {
    console.error('NOT FOUND:', job.path, ':', job.from.slice(0, 60))
    continue
  }
  s = s.replace(job.from, job.to)
  writeFileSync(p, s)
  console.log('patched:', job.path)
}
