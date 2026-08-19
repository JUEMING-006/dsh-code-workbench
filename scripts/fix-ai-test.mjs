// Fix the AI-activity test: the panel is real now, and the session stub needs ids.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/tests/regions.client.spec.tsx', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const fromState = `const sessionsState = {
  current: 's1',
  byId: { s1: { cwd: '/w' } },
} as unknown as SessionListState`
const toState = `const sessionsState = {
  current: 's1',
  ids: ['s1'],
  byId: { s1: { cwd: '/w', displayTitle: 'Test Session' } },
} as unknown as SessionListState`

const fromTest = `  it('shows placeholders for the not-yet-built activities', () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <WorkbenchContext.Provider value={{ editor, fs, editorSurface, sessions, workspaces }}>
        <SidebarContent activity="ai" useSessions={useSessionsStub} />
      </WorkbenchContext.Provider>,
    )
    expect(screen.getByText(/AI assistant panel coming soon/)).toBeTruthy()
  })`
const toTest = `  it('shows the AI assistant panel for the ai activity', () => {
    const fs = fakeFs()
    const editor = createEditorStore().create()
    render(
      <WorkbenchContext.Provider value={{ editor, fs, editorSurface, sessions, workspaces }}>
        <SidebarContent activity="ai" useSessions={useSessionsStub} />
      </WorkbenchContext.Provider>,
    )
    expect(document.querySelector('[data-ai-panel]')).toBeTruthy()
    // No bound session in tests: the panel shows its guidance.
    expect(screen.getByText(/Select or create a session/)).toBeTruthy()
  })`

let changed = false
for (const [from, to] of [[fromState, toState], [fromTest, toTest]]) {
  if (s.includes(from)) {
    s = s.replace(from, to)
    changed = true
  } else {
    console.log('not-found:', from.slice(0, 60).replaceAll('\n', '\\n'))
  }
}
writeFileSync(p, s)
console.log(changed ? 'patched' : 'no-change')
