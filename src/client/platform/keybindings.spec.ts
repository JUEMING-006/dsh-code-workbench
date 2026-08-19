/**
 * Keybinding plumbing tests: chord normalization (Ctrl/Meta collapse,
 * modifier-only and plain presses produce nothing), definition forms, labels,
 * rule-table resolution, and two-step chord (Ctrl+K prefix) resolution.
 */
import { describe, expect, it } from 'vitest'
import { chordOf, chordOfDef, keybindingLabel, resolveChord, resolveKeyPress } from './keybindings.ts'
import { DEFAULT_KEYBINDINGS } from './commands.ts'

describe('chordOf', () => {
  it('normalizes ctrl and meta to one chord form', () => {
    expect(chordOf({ key: 'p', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe('ctrl+p')
    expect(chordOf({ key: 'p', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false })).toBe('ctrl+p')
    expect(chordOf({ key: 'B', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false })).toBe('ctrl+alt+b')
    expect(chordOf({ key: 'P', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })).toBe('ctrl+shift+p')
    expect(chordOf({ key: '`', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe('ctrl+`')
  })

  it('ignores plain typing and bare modifier presses', () => {
    expect(chordOf({ key: 'p', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false })).toBeUndefined()
    expect(chordOf({ key: 'Control', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBeUndefined()
    expect(chordOf({ key: 'Alt', ctrlKey: false, metaKey: false, altKey: true, shiftKey: false })).toBeUndefined()
  })
})

describe('chordOfDef and keybindingLabel', () => {
  it('builds the canonical chord from a definition', () => {
    expect(chordOfDef({ key: 'p', ctrl: true, shift: true })).toBe('ctrl+shift+p')
    expect(chordOfDef({ key: 'b', ctrl: true, alt: true })).toBe('ctrl+alt+b')
  })

  it('renders menu-style labels', () => {
    expect(keybindingLabel({ key: 'p', ctrl: true, shift: true })).toBe('Ctrl+Shift+P')
    expect(keybindingLabel({ key: 'b', ctrl: true, alt: true })).toBe('Ctrl+Alt+B')
    expect(keybindingLabel({ key: '`', ctrl: true })).toBe('Ctrl+`')
  })
})

describe('resolveChord', () => {
  it('routes events through the default rule table', () => {
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'p', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }))
      .toBe('workbench.action.showCommands')
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }))
      .toBe('workbench.action.toggleSidebarVisibility')
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'b', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }))
      .toBe('workbench.action.toggleAuxiliaryBar')
  })

  it('returns undefined for unbound and chordless presses', () => {
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'x', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBeUndefined()
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'x', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false })).toBeUndefined()
  })

  it('never resolves two-step chord rules from a bare press', () => {
    // Ctrl+Z alone is the second key of Ctrl+K Ctrl+Z — it must not fire the
    // chord command without its prefix.
    expect(resolveChord(DEFAULT_KEYBINDINGS, { key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBeUndefined()
  })
})

describe('resolveKeyPress', () => {
  const ctrl = (key: string): { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean } =>
    ({ key, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })

  it('opens a pending wait on a chord prefix', () => {
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, ctrl('k'))).toEqual({ kind: 'pending', prefix: { key: 'k', ctrl: true } })
  })

  it('completes a pending prefix with its second key', () => {
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, ctrl('z'), 'ctrl+k'))
      .toEqual({ kind: 'command', commandId: 'workbench.action.toggleZenMode' })
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, { ...ctrl('\\'), shiftKey: false, key: '\\' }, 'ctrl+k'))
      .toEqual({ kind: 'command', commandId: 'workbench.action.splitEditorOrthogonal' })
  })

  it('cancels the wait on an unbound second key or Esc', () => {
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, ctrl('x'), 'ctrl+k')).toBeUndefined()
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, { key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, 'ctrl+k')).toBeUndefined()
  })

  it('resolves plain bindings without a pending prefix', () => {
    expect(resolveKeyPress(DEFAULT_KEYBINDINGS, { key: 'p', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }))
      .toEqual({ kind: 'command', commandId: 'workbench.action.showCommands' })
  })
})
