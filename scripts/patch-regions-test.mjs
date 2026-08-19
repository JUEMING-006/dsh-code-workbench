// One-off test-file patch: add the textarea surface to every provider mount.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/tests/regions.client.spec.tsx', import.meta.url)
let s = readFileSync(p, 'utf8')
const before = s.length
s = s.split('<WorkbenchContext.Provider value={{ editor, fs }}>')
  .join('<WorkbenchContext.Provider value={{ editor, fs, editorSurface }}>')
if (!s.includes("import { TextareaEditorSurface }")) {
  s = s.replace(
    "import { createEditorStore } from '../workbench/editor-store.ts'",
    "import { createEditorStore } from '../workbench/editor-store.ts'\nimport { TextareaEditorSurface } from '../editor/EditorSurface.tsx'",
  )
  s = s.replace(
    "import { SidebarContent } from '../workbench/parts/SidebarContent.tsx'",
    "import { SidebarContent } from '../workbench/parts/SidebarContent.tsx'\n\n/** Surface stand-in every test mount provides (deterministic, no monaco). */\nconst editorSurface = TextareaEditorSurface",
  )
}
writeFileSync(p, s)
console.log('changed:', before !== s.length)
