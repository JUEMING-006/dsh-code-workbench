// Adds sessions/workspaces stubs to the region tests and the shell fallback.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  {
    path: '../src/client/tests/regions.client.spec.tsx',
    replacements: [
      {
        from: "/** Surface stand-in every test mount provides (deterministic, no monaco). */\nconst editorSurface = TextareaEditorSurface",
        to: `/** Surface stand-in every test mount provides (deterministic, no monaco). */\nconst editorSurface = TextareaEditorSurface\n\n/** Sessions/workspaces stand-ins (no host service in tests). */\nconst sessions = { open: vi.fn(), binding: vi.fn(() => undefined) }\nconst workspaces = { startSession: vi.fn() }`,
      },
    ],
  },
  {
    path: '../src/client/workbench/WorkbenchShell.tsx',
    replacements: [
      {
        from: "import { createEditorStore } from './editor-store.ts'",
        to: "import { createEditorStore } from './editor-store.ts'\nimport { getWorkbenchServices } from './services.ts'",
      },
      {
        from: `  // One service set per shell mount: the editor store instance shared by the\n  // explorer and the editor, plus the fs gateway client.\n  const servicesRef = useRef<WorkbenchServices | null>(null)\n  if (servicesRef.current === null) {\n    servicesRef.current = {\n      editor: createEditorStore().create(),\n      fs: createFsClient(),\n    }\n  }`,
        to: `  // One service set per shell mount: the apply-time set when installed\n  // (sessions/workspaces reachable only from the plugin body), else the\n  // standalone fallback (tests, embeds) with fs and the editor only.\n  const servicesRef = useRef<WorkbenchServices | null>(null)\n  if (servicesRef.current === null) {\n    servicesRef.current = getWorkbenchServices() ?? {\n      editor: createEditorStore().create(),\n      fs: createFsClient(),\n    }\n  }`,
      },
    ],
  },
]

for (const file of files) {
  const p = new URL(file.path, import.meta.url)
  let s = readFileSync(p, 'utf8')
  for (const r of file.replacements) {
    if (!s.includes(r.to)) {
      if (!s.includes(r.from)) {
        console.error('NOT FOUND in', file.path, ':', r.from.slice(0, 70))
        continue
      }
      s = s.replace(r.from, r.to)
      console.log('fixed:', file.path)
    }
  }
  writeFileSync(p, s)
}
