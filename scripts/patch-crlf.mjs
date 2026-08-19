// CRLF-aware patches: shell servicesRef logic + region test stubs.
import { readFileSync, writeFileSync } from 'node:fs'

function patch(file, pairs) {
  const p = new URL(file, import.meta.url)
  let s = readFileSync(p, 'utf8')
  for (const { from, to } of pairs) {
    // Normalize both sides to LF for matching, write back LF (repo convention).
    const hay = s.replaceAll('\r\n', '\n')
    if (!hay.includes(from)) {
      console.error('NOT FOUND in', file, ':', from.slice(0, 60).replaceAll('\n', '\\n'))
      continue
    }
    writeFileSync(p, hay.replace(from, to))
    console.log('patched:', file)
  }
}

patch('../src/client/workbench/WorkbenchShell.tsx', [
  {
    from: `  // One service set per shell mount: the editor store instance shared by the
  // explorer and the editor, plus the fs gateway client.
  const servicesRef = useRef<WorkbenchServices | null>(null)
  if (servicesRef.current === null) {
    servicesRef.current = {
      editor: createEditorStore().create(),
      fs: createFsClient(),
    }
  }`,
    to: `  // One service set per shell mount: the apply-time set when installed
  // (sessions/workspaces reachable only from the plugin body), else the
  // standalone fallback (tests, embeds) with fs and the editor only.
  const servicesRef = useRef<WorkbenchServices | null>(null)
  if (servicesRef.current === null) {
    servicesRef.current = getWorkbenchServices() ?? {
      editor: createEditorStore().create(),
      fs: createFsClient(),
    }
  }`,
  },
])

patch('../src/client/tests/regions.client.spec.tsx', [
  {
    from: `/** Surface stand-in every test mount provides (deterministic, no monaco). */
const editorSurface = TextareaEditorSurface`,
    to: `/** Surface stand-in every test mount provides (deterministic, no monaco). */
const editorSurface = TextareaEditorSurface

/** Sessions/workspaces stand-ins (no host service in tests). */
const sessions = { open: vi.fn(), binding: vi.fn(() => undefined) }
const workspaces = { startSession: vi.fn() }`,
  },
])
