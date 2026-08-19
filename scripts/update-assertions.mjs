// Update assertions for the VS Code-aligned UI (labels, icons, welcome).
import { readFileSync, writeFileSync } from 'node:fs'

const jobs = [
  {
    path: '../src/client/tests/regions.client.spec.tsx',
    pairs: [
      [
        "    expect(screen.getByText(/Open a file from the explorer/)).toBeTruthy()",
        "    expect(screen.getByText(/Welcome to Code Mode/)).toBeTruthy()",
      ],
    ],
  },
  {
    path: '../src/client/tests/shell.client.spec.tsx',
    pairs: [
      [
        `    // Activity rail renders the four entries.
    expect(screen.getByRole('button', { name: 'AI' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Files' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()`,
        `    // Activity rail renders the four icon entries (VS Code labels).
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()`,
      ],
      [
        `    expect(instance.getSnapshot().activity).toBe('ai')
    fireEvent.click(screen.getByRole('button', { name: 'Files' }))
    expect(instance.getSnapshot().activity).toBe('files')
    expect(screen.getByRole('button', { name: 'Files' }).getAttribute('aria-pressed')).toBe('true')`,
        `    expect(instance.getSnapshot().activity).toBe('ai')
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))
    expect(instance.getSnapshot().activity).toBe('files')
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-pressed')).toBe('true')`,
      ],
      [
        `    expect(document.querySelector('[data-workbench-mode]')?.textContent).toBe('Code Mode')`,
        `    expect(document.querySelector('[data-workbench-mode]')?.textContent).toContain('Code Mode')`,
      ],
    ],
  },
]

for (const job of jobs) {
  const p = new URL(job.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  for (const [from, to] of job.pairs) {
    if (s.includes(to)) continue
    if (!s.includes(from)) {
      console.error('NOT FOUND in', job.path, ':', from.slice(0, 60).replaceAll('\n', '\\n'))
      continue
    }
    s = s.replace(from, to)
    console.log('patched:', job.path)
  }
  writeFileSync(p, s)
}
