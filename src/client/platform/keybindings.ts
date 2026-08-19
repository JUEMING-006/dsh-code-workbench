/**
 * Keybinding plumbing: normalized chords and a table-driven dispatcher. A
 * chord is the canonical string form ("ctrl+alt+b", "ctrl+shift+p",
 * "ctrl+`"): Ctrl and Meta collapse to one modifier (macOS Cmd parity), key
 * names lowercase. Pure modifier presses produce no chord.
 */

/** One key combination's modifier set. */
export interface KeybindingDef {
  readonly key: string
  readonly ctrl?: boolean
  readonly alt?: boolean
  readonly shift?: boolean
}

/** The keyboard event surface chordOf reads (KeyboardEvent-shaped). */
export interface ChordEvent {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/** Pure modifier key names that never form a chord on their own. */
const MODIFIER_KEYS = new Set(['control', 'meta', 'alt', 'shift'])

/**
 * Canonical chord for a keyboard event, or undefined when the press is a bare
 * modifier or carries no modifier (plain typing never dispatches commands).
 */
export function chordOf(event: ChordEvent): string | undefined {
  const key = event.key.toLowerCase()
  if (MODIFIER_KEYS.has(key)) return undefined
  if (!event.ctrlKey && !event.metaKey) return undefined
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

/** Canonical chord for a definition ("ctrl+shift+p"). */
export function chordOfDef(def: KeybindingDef): string {
  const parts: string[] = []
  if (def.ctrl === true) parts.push('ctrl')
  if (def.alt === true) parts.push('alt')
  if (def.shift === true) parts.push('shift')
  parts.push(def.key.toLowerCase())
  return parts.join('+')
}

/** Display label for a definition ("Ctrl+Shift+P" — VS Code menu convention). */
export function keybindingLabel(def: KeybindingDef): string {
  const parts: string[] = []
  if (def.ctrl === true) parts.push('Ctrl')
  if (def.alt === true) parts.push('Alt')
  if (def.shift === true) parts.push('Shift')
  parts.push(def.key.length === 1 ? def.key.toUpperCase() : def.key.charAt(0).toUpperCase() + def.key.slice(1))
  return parts.join('+')
}

/** One rule: a chord dispatches one command id; a `prefix` makes it a two-step
 * chord (VS Code Ctrl+K style: the prefix opens a pending wait, the `def`
 * completes it). Prefixed rules never resolve from a bare press. */
export interface KeybindingRule {
  readonly def: KeybindingDef
  /** First chord of a two-step binding; the rule completes only after it. */
  readonly prefix?: KeybindingDef
  readonly commandId: string
}

/** Resolve an event's chord to a command id through the rule table (chords
 * that need a prefix wait never resolve here — callers use {@link resolveKeyPress}). */
export function resolveChord(rules: readonly KeybindingRule[], event: ChordEvent): string | undefined {
  const chord = chordOf(event)
  if (chord === undefined) return undefined
  return rules.find(rule => rule.prefix === undefined && chordOfDef(rule.def) === chord)?.commandId
}

/** One press resolution: a completed command, or a chord prefix awaiting its second key. */
export type KeyResolution =
  | { kind: 'command'; commandId: string }
  | { kind: 'pending'; prefix: KeybindingDef }

/**
 * Resolve a key press through the rule table, honoring two-step chords.
 * With a pending prefix, only a rule whose prefix matches may complete; any
 * other press (Esc included) yields undefined and the caller cancels the wait.
 * Without one, a prefix-opening press starts a wait and anything else
 * resolves as a plain binding.
 * @param rules - the rule table.
 * @param event - the keyboard event.
 * @param pendingPrefix - the chord prefix currently awaiting its second key.
 * @returns the resolution, or undefined when the press cancels/resolves nothing.
 */
export function resolveKeyPress(
  rules: readonly KeybindingRule[],
  event: ChordEvent,
  pendingPrefix?: string,
): KeyResolution | undefined {
  const chord = chordOf(event)
  if (chord === undefined) return undefined
  if (pendingPrefix !== undefined) {
    const completion = rules.find(rule =>
      rule.prefix !== undefined && chordOfDef(rule.prefix) === pendingPrefix && chordOfDef(rule.def) === chord)
    return completion === undefined ? undefined : { kind: 'command', commandId: completion.commandId }
  }
  const opener = rules.find(rule => rule.prefix !== undefined && chordOfDef(rule.prefix) === chord)
  const prefix = opener?.prefix
  if (prefix !== undefined) return { kind: 'pending', prefix }
  const direct = rules.find(rule => rule.prefix === undefined && chordOfDef(rule.def) === chord)
  return direct === undefined ? undefined : { kind: 'command', commandId: direct.commandId }
}
