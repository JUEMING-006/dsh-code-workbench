// Update the README harness-mode description.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../README.md', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
const from = "- **Zero footprint in harness mode**: the browser half's `apply` is a no-op unless the store says `workbench` — no registration, no listeners, no DOM writes."
const to = "- **Harness entry point**: the browser half always registers one floating toggle into the harness frame's `shell.overlay` layer — pinned to the top-right, it switches into code mode and back. In workbench mode the frame stops rendering the overlay, so the button naturally disappears and the workbench status-bar switch takes over."
if (s.includes(from)) {
  s = s.replace(from, to)
  writeFileSync(p, s)
  console.log('readme updated')
} else {
  console.log('miss')
}
