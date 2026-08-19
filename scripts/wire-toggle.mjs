// Registers the floating mode toggle into apply and updates its doc.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/client/apply.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const pairs = [
  [
    `/**
 * Client plugin body: the boot-time mode decision and the conditional root
 * registration.
 *
 * The plugin is inert in harness mode — no registration, no listeners, no
 * DOM writes — so an installation that never switches leaves the page
 * byte-identical. In code mode it registers the workbench shell into the
 * built-in root slot with an explicit lower shadowing priority than the
 * harness AppFrame (priority -1 < its default 0), so the workbench wins the
 * root cell and the harness shell stops rendering. A workbench render crash
 * abdicates in the other direction: the harness shell takes over
 * automatically. (Static roster plugins get no automatic priority — the
 * page-local rank the cordis-client-runner guard assigns applies to dynamic
 * packages only — so the shadowing priority must be explicit.)
 */`,
    `/**
 * Client plugin body: the boot-time mode decision and the conditional root
 * registration.
 *
 * One contribution is unconditional: the floating mode toggle, registered
 * into the harness frame's shell.overlay layer — the harness page's entry
 * point into code mode. In harness mode the frame renders it; in workbench
 * mode the frame stops rendering (the workbench shadows the root), so the
 * affordance disappears and the workbench's own status-bar switch takes
 * over.
 *
 * The workbench shell itself registers only in code mode, into the built-in
 * root slot with an explicit lower shadowing priority than the harness
 * AppFrame (priority -1 < its default 0), so the workbench wins the root
 * cell and the harness shell stops rendering. A workbench render crash
 * abdicates in the other direction: the harness shell takes over
 * automatically. (Static roster plugins get no automatic priority — the
 * page-local rank the cordis-client-runner guard assigns applies to dynamic
 * packages only — so the shadowing priority must be explicit.)
 */`,
  ],
  [
    `import { createFsClient } from './fs/client.ts'
import { readGlobalMode } from './mode/store.ts'`,
    `import { createFsClient } from './fs/client.ts'
import { ModeToggleButton } from './mode/ModeToggleButton.tsx'
import { readGlobalMode } from './mode/store.ts'`,
  ],
  [
    `export function apply(ctx: Context): void {
  if (readGlobalMode(globalThis.localStorage) !== 'workbench') return
  // The service set the shell provides to its regions. Built here because
  // the host service faces (sessions/workspaces) are only reachable from a
  // plugin body, not from a pure slot component.
  installWorkbenchServices({`,
    `export function apply(ctx: Context): void {
  // The harness-mode entry point, registered unconditionally: in workbench
  // mode the frame stops rendering the overlay layer, so the button simply
  // ceases to exist there.
  ctx.effect(
    () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'code-workbench-mode-toggle',
      order: 10,
    }, ModeToggleButton),
    'code-workbench: floating mode toggle',
  )
  if (readGlobalMode(globalThis.localStorage) !== 'workbench') return
  // The service set the shell provides to its regions. Built here because
  // the host service faces (sessions/workspaces) are only reachable from a
  // plugin body, not from a pure slot component.
  installWorkbenchServices({`,
  ],
]

for (const [from, to] of pairs) {
  if (s.includes(to)) continue
  if (!s.includes(from)) {
    console.error('NOT FOUND:', from.slice(0, 70).replaceAll('\n', '\\n'))
    continue
  }
  s = s.replace(from, to)
  console.log('patched')
}
writeFileSync(p, s)
