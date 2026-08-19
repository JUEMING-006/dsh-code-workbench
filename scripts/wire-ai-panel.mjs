// Wire the AiPanel into the sidebar AI activity.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/workbench/parts/SidebarContent.tsx', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const fromBranch = `  if (activity === 'ai') {
    // P2: the native AI assistant panel.
    return <Placeholder label="AI assistant" />
  }`
const toBranch = `  if (activity === 'ai') {
    return <AiPanel useSessions={useSessions} />
  }`

const fromImport = "import { FilesView } from './FilesView.tsx'"
const toImport = "import { AiPanel } from '../../ai/AiPanel.tsx'\nimport { FilesView } from './FilesView.tsx'"

let changed = false
if (s.includes(fromBranch)) {
  s = s.replace(fromBranch, toBranch)
  changed = true
} else {
  console.log('branch not-found (maybe already patched)')
}
if (!s.includes("../../ai/AiPanel")) {
  if (s.includes(fromImport)) {
    s = s.replace(fromImport, toImport)
    changed = true
  } else {
    console.log('import not-found')
  }
}
writeFileSync(p, s)
console.log(changed ? 'patched' : 'no-change')
