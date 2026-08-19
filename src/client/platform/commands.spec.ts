/**
 * Command-registry tests: table integrity (every binding and menu entry
 * resolves to a declared command, ids unique) and command bodies wired to
 * the args they receive.
 */
import { describe, expect, it, vi } from 'vitest'
import type { CommandRunArgs } from './commands.ts'
import { COMMANDS, DEFAULT_KEYBINDINGS, MENUS, commandOf } from './commands.ts'

/** Args double recording every verb. */
function fakeArgs(): CommandRunArgs & {
  layout: Record<keyof CommandRunArgs['layout'], ReturnType<typeof vi.fn>>
  quickInput: Record<keyof CommandRunArgs['quickInput'], ReturnType<typeof vi.fn>>
  editor: Record<keyof CommandRunArgs['editor'], ReturnType<typeof vi.fn>>
} {
  return {
    layout: {
      toggleSidebar: vi.fn(),
      toggleAuxBar: vi.fn(),
      togglePanel: vi.fn(),
      setPanelPosition: vi.fn(),
      togglePanelMaximize: vi.fn(),
      toggleZen: vi.fn(),
    },
    quickInput: {
      openFiles: vi.fn(),
      openCommands: vi.fn(),
    },
    editor: {
      split: vi.fn(),
      closeActiveGroup: vi.fn(),
      closeActiveTab: vi.fn(),
    },
    exitCodeMode: vi.fn(),
  } as never
}

describe('command registry', () => {
  it('has unique command ids', () => {
    const ids = COMMANDS.map(command => command.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every keybinding bound to a declared command', () => {
    for (const rule of DEFAULT_KEYBINDINGS) {
      expect(commandOf(rule.commandId), rule.commandId).toBeDefined()
    }
  })

  it('binds the editor-split and close-editor chords', () => {
    expect(commandOf('workbench.action.splitEditor')?.binding?.def).toMatchObject({ key: '\\', ctrl: true })
    expect(commandOf('workbench.action.closeActiveEditor')?.binding?.def).toMatchObject({ key: 'w', ctrl: true })
  })

  it('keeps every menu entry bound to a declared command', () => {
    for (const menu of MENUS) {
      for (const item of menu.items) {
        expect(commandOf(item.commandId), `${menu.label}: ${item.commandId}`).toBeDefined()
      }
    }
  })

  it('returns undefined for unknown ids', () => {
    expect(commandOf('workbench.action.nope')).toBeUndefined()
  })
})

describe('command bodies', () => {
  it('opens the two quick-input surfaces', () => {
    const args = fakeArgs()
    commandOf('workbench.action.quickOpen')!.run(args)
    expect(args.quickInput.openFiles).toHaveBeenCalledTimes(1)
    commandOf('workbench.action.showCommands')!.run(args)
    expect(args.quickInput.openCommands).toHaveBeenCalledTimes(1)
  })

  it('routes layout verbs', () => {
    const args = fakeArgs()
    commandOf('workbench.action.toggleSidebarVisibility')!.run(args)
    commandOf('workbench.action.toggleAuxiliaryBar')!.run(args)
    commandOf('workbench.action.togglePanel')!.run(args)
    commandOf('workbench.action.toggleMaximizePanel')!.run(args)
    commandOf('workbench.action.toggleZenMode')!.run(args)
    commandOf('workbench.action.movePanelRight')!.run(args)
    expect(args.layout.toggleSidebar).toHaveBeenCalledTimes(1)
    expect(args.layout.toggleAuxBar).toHaveBeenCalledTimes(1)
    expect(args.layout.togglePanel).toHaveBeenCalledTimes(1)
    expect(args.layout.togglePanelMaximize).toHaveBeenCalledTimes(1)
    expect(args.layout.toggleZen).toHaveBeenCalledTimes(1)
    expect(args.layout.setPanelPosition).toHaveBeenCalledWith('right')
  })

  it('exits code mode', () => {
    const args = fakeArgs()
    commandOf('workbench.action.exitCodeMode')!.run(args)
    expect(args.exitCodeMode).toHaveBeenCalledTimes(1)
  })

  it('routes editor-group verbs', () => {
    const args = fakeArgs()
    commandOf('workbench.action.splitEditor')!.run(args)
    commandOf('workbench.action.splitEditorOrthogonal')!.run(args)
    commandOf('workbench.action.joinAllGroups')!.run(args)
    commandOf('workbench.action.closeActiveEditor')!.run(args)
    expect(args.editor.split).toHaveBeenCalledWith('horizontal')
    expect(args.editor.split).toHaveBeenCalledWith('vertical')
    expect(args.editor.closeActiveGroup).toHaveBeenCalledTimes(1)
    expect(args.editor.closeActiveTab).toHaveBeenCalledTimes(1)
  })

  it('declares the Ctrl+K prefix on the chord commands', () => {
    expect(commandOf('workbench.action.splitEditorOrthogonal')?.binding?.prefix).toMatchObject({ key: 'k', ctrl: true })
    expect(commandOf('workbench.action.toggleZenMode')?.binding?.prefix).toMatchObject({ key: 'k', ctrl: true })
  })
})
