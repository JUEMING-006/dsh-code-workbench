/**
 * The workbench command registry: structured command ids
 * (workbench.action.*) with category, title, run, and default keybinding.
 * One table drives the command palette, the menu bar, and the keybinding
 * dispatcher — a command added here is reachable from all three.
 */

import type { PanelPosition } from '../workbench/geometry.ts'
import type { KeybindingRule } from './keybindings.ts'
import type { MessageId } from '../i18n/ids.ts'
import { dirnameOf } from '../fs/client.ts'

/** The explorer resource a context-menu command targets (a tree node). */
export interface CommandResource {
  /** Display path of the node the menu was opened on. */
  readonly path: string
  readonly isDirectory: boolean
}

/**
 * The explorer mutation verbs the shell implements (name prompts ride the
 * Quick Input; the mutations ride the fs/fs-ops gateways; each success
 * refreshes the tree).
 */
export interface ExplorerVerbs {
  create(kind: 'file' | 'folder', parentDir: string | undefined): void
  rename(path: string): void
  remove(path: string, isDirectory: boolean): void
  openFolder?(): void
}

/** The layout actions the commands call (the shell's baked store actions). */
export interface CommandRunArgs {
  readonly layout: {
    toggleSidebar(): void
    toggleAuxBar(): void
    togglePanel(): void
    setPanelPosition(position: PanelPosition): void
    togglePanelMaximize(): void
    toggleZen(): void
  }
  /** Open the Quick Input in the given mode (shell-provided). */
  readonly quickInput: {
    openFiles(): void
    openCommands(): void
  }
  /** Editor-group verbs (the shell's editor store actions). */
  readonly editor: {
    split(direction: 'horizontal' | 'vertical'): void
    closeActiveGroup(): void
    closeActiveTab(): void
    save(): void
  }
  /** Explorer mutation verbs (shell-provided; prompt + gateway + refresh). */
  readonly explorer: ExplorerVerbs
  /** The explorer node a context-menu command targets; absent from palette runs. */
  readonly resource?: CommandResource
  /** Switch back to the harness shell (writes the mode store and reloads). */
  exitCodeMode(): void
}

/** One command: identity + palette/menu metadata + body. */
export interface CommandEntry {
  readonly id: string
  readonly category: string
  /** Localized title (MessageId resolved by the i18n layer at render time). */
  readonly title: MessageId
  /** Default keybinding, if any. */
  readonly binding?: KeybindingRule
  readonly run: (args: CommandRunArgs) => void
}

/** The parent directory a resource's create should target: a directory is
 * its own parent; a file contributes its directory. undefined (no resource)
 * resolves at the shell — the current session workspace root. */
function parentDirOf(resource: CommandResource | undefined): string | undefined {
  if (resource === undefined) return undefined
  if (resource.isDirectory) return resource.path
  return dirnameOf(resource.path)
}

/** The command table, palette order. */
export const COMMANDS: readonly CommandEntry[] = [
  {
    id: 'workbench.action.quickOpen',
    category: 'View',
    title: 'cmd.quickOpen.title',
    binding: { def: { key: 'p', ctrl: true }, commandId: 'workbench.action.quickOpen' },
    run: args => { args.quickInput.openFiles() },
  },
  {
    id: 'workbench.action.showCommands',
    category: 'View',
    title: 'cmd.showAllCommands.title',
    binding: { def: { key: 'p', ctrl: true, shift: true }, commandId: 'workbench.action.showCommands' },
    run: args => { args.quickInput.openCommands() },
  },
  {
    id: 'workbench.action.toggleSidebarVisibility',
    category: 'View',
    title: 'view.toggleSidebar',
    binding: { def: { key: 'b', ctrl: true }, commandId: 'workbench.action.toggleSidebarVisibility' },
    run: args => { args.layout.toggleSidebar() },
  },
  {
    id: 'workbench.action.toggleAuxiliaryBar',
    category: 'View',
    title: 'view.toggleAuxBar',
    binding: { def: { key: 'b', ctrl: true, alt: true }, commandId: 'workbench.action.toggleAuxiliaryBar' },
    run: args => { args.layout.toggleAuxBar() },
  },
  {
    id: 'workbench.action.togglePanel',
    category: 'View',
    title: 'view.togglePanel',
    binding: { def: { key: 'j', ctrl: true }, commandId: 'workbench.action.togglePanel' },
    run: args => { args.layout.togglePanel() },
  },
  {
    id: 'workbench.action.terminal.toggleTerminal',
    category: 'Terminal',
    title: 'terminal.toggle',
    binding: { def: { key: '`', ctrl: true }, commandId: 'workbench.action.terminal.toggleTerminal' },
    run: args => { args.layout.togglePanel() },
  },
  {
    id: 'workbench.action.movePanelLeft',
    category: 'View',
    title: 'view.movePanelLeft',
    run: args => { args.layout.setPanelPosition('left') },
  },
  {
    id: 'workbench.action.movePanelRight',
    category: 'View',
    title: 'view.movePanelRight',
    run: args => { args.layout.setPanelPosition('right') },
  },
  {
    id: 'workbench.action.movePanelBottom',
    category: 'View',
    title: 'view.movePanelBottom',
    run: args => { args.layout.setPanelPosition('bottom') },
  },
  {
    id: 'workbench.action.toggleMaximizePanel',
    category: 'View',
    title: 'view.toggleMaximizePanel',
    run: args => { args.layout.togglePanelMaximize() },
  },
  {
    id: 'workbench.action.toggleZenMode',
    category: 'View',
    title: 'view.toggleZenMode',
    binding: { def: { key: 'z', ctrl: true }, prefix: { key: 'k', ctrl: true }, commandId: 'workbench.action.toggleZenMode' },
    run: args => { args.layout.toggleZen() },
  },
  {
    id: 'workbench.action.splitEditor',
    category: 'View',
    title: 'view.splitEditor',
    binding: { def: { key: '\\', ctrl: true }, commandId: 'workbench.action.splitEditor' },
    run: args => { args.editor.split('horizontal') },
  },
  {
    id: 'workbench.action.splitEditorOrthogonal',
    category: 'View',
    title: 'view.splitEditorOrthogonal',
    binding: { def: { key: '\\', ctrl: true }, prefix: { key: 'k', ctrl: true }, commandId: 'workbench.action.splitEditorOrthogonal' },
    run: args => { args.editor.split('vertical') },
  },
  {
    id: 'workbench.action.closeActiveEditor',
    category: 'View',
    title: 'view.closeEditor',
    binding: { def: { key: 'w', ctrl: true }, commandId: 'workbench.action.closeActiveEditor' },
    run: args => { args.editor.closeActiveTab() },
  },
  {
    id: 'workbench.action.files.save',
    category: 'File',
    title: 'editor.save',
    binding: { def: { key: 's', ctrl: true }, commandId: 'workbench.action.files.save' },
    run: args => { args.editor.save() },
  },
  {
    id: 'workbench.action.joinAllGroups',
    category: 'View',
    title: 'view.joinEditorGroups',
    run: args => { args.editor.closeActiveGroup() },
  },
  {
    id: 'workbench.action.exitCodeMode',
    category: 'Help',
    title: 'status.exitCodeMode',
    run: args => { args.exitCodeMode() },
  },
  {
    id: 'workbench.action.files.openFolder',
    category: 'File',
    title: 'explorer.openFolder',
    binding: { def: { key: 'o', ctrl: true }, commandId: 'workbench.action.files.openFolder' },
    run: args => { args.explorer.openFolder?.() },
  },
  {
    id: 'codeWorkbench.newFile',
    category: 'Explorer',
    title: 'explorer.newFile',
    binding: { def: { key: 'n', ctrl: true }, commandId: 'codeWorkbench.newFile' },
    run: args => { args.explorer.create('file', parentDirOf(args.resource)) },
  },
  {
    id: 'codeWorkbench.newFolder',
    category: 'Explorer',
    title: 'explorer.newFolder',
    run: args => { args.explorer.create('folder', parentDirOf(args.resource)) },
  },
  {
    id: 'codeWorkbench.rename',
    category: 'Explorer',
    title: 'explorer.rename',
    run: args => { if (args.resource !== undefined) args.explorer.rename(args.resource.path) },
  },
  {
    id: 'codeWorkbench.delete',
    category: 'Explorer',
    title: 'explorer.delete',
    run: args => {
      if (args.resource !== undefined) args.explorer.remove(args.resource.path, args.resource.isDirectory)
    },
  },
]

/** The flat keybinding rule table the dispatcher consumes. */
export const DEFAULT_KEYBINDINGS: readonly KeybindingRule[] = COMMANDS.flatMap(
  command => command.binding !== undefined ? [command.binding] : [],
)

/** Menu bar model derived from the command table: category groups,
 * standard menu order. Labels are i18n MessageIds resolved at render time. */
export const MENUS: readonly { label: MessageId; items: readonly { commandId: string }[] }[] = [
  {
    label: 'menu.file',
    items: [
      { commandId: 'workbench.action.files.openFolder' },
      { commandId: 'codeWorkbench.newFile' },
      { commandId: 'codeWorkbench.newFolder' },
      { commandId: 'workbench.action.quickOpen' },
      { commandId: 'workbench.action.files.save' },
    ],
  },
  {
    label: 'menu.view',
    items: [
      { commandId: 'workbench.action.showCommands' },
      { commandId: 'workbench.action.quickOpen' },
      { commandId: 'workbench.action.toggleSidebarVisibility' },
      { commandId: 'workbench.action.toggleAuxiliaryBar' },
      { commandId: 'workbench.action.togglePanel' },
      { commandId: 'workbench.action.toggleMaximizePanel' },
      { commandId: 'workbench.action.movePanelLeft' },
      { commandId: 'workbench.action.movePanelRight' },
      { commandId: 'workbench.action.movePanelBottom' },
      { commandId: 'workbench.action.splitEditor' },
      { commandId: 'workbench.action.closeActiveEditor' },
      { commandId: 'workbench.action.joinAllGroups' },
      { commandId: 'workbench.action.toggleZenMode' },
    ],
  },
  {
    label: 'menu.terminal',
    items: [
      { commandId: 'workbench.action.terminal.toggleTerminal' },
    ],
  },
  {
    label: 'menu.help',
    items: [
      { commandId: 'workbench.action.exitCodeMode' },
    ],
  },
]

/** Find one command by id (undefined when the id is unknown — misconfiguration
 * fails loud at the caller). */
export function commandOf(id: string): CommandEntry | undefined {
  return COMMANDS.find(command => command.id === id)
}

/** The four right-click zones the workbench offers. */
export type ContextMenuZone = 'explorer/context' | 'editor/title/context' | 'editor/context' | 'chat/context'

/** Command ids per zone; ids live in the command table, regions execute. */
export const CONTEXT_MENUS: Readonly<Record<ContextMenuZone, readonly string[]>> = {
  'explorer/context': [
    'codeWorkbench.newFile',
    'codeWorkbench.newFolder',
    'codeWorkbench.rename',
    'codeWorkbench.delete',
  ],
  'editor/title/context': [
    'workbench.action.files.save',
    'workbench.action.splitEditor',
    'workbench.action.closeActiveEditor',
  ],
  'editor/context': [
    'workbench.action.files.save',
    'workbench.action.splitEditor',
    'workbench.action.closeActiveEditor',
  ],
  'chat/context': [
    'workbench.action.toggleAuxiliaryBar',
  ],
}

/** One context-menu row: the command plus its resolved label. */
export interface ContextMenuEntry {
  readonly commandId: string
  readonly label: string
  /** Destructive entries render in the error color. */
  readonly danger: boolean
}

/** Resolve a zone's entries through the command table (labels, danger flag). */
export function contextMenuEntries(zone: ContextMenuZone): readonly ContextMenuEntry[] {
  return CONTEXT_MENUS[zone].map(commandId => {
    const command = commandOf(commandId)
    if (command === undefined) throw new Error(`context menu references unknown command ${commandId}`)
    return { commandId, label: command.title, danger: commandId === 'codeWorkbench.delete' }
  })
}
