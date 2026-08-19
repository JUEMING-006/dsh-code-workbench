/**
 * Quick Input: the single widget behind the quick entry surfaces — Ctrl+P
 * Go to File (fuzzy file picker over the workspace listing), Ctrl+Shift+P
 * Show All Commands (fuzzy command palette), and the one-line prompt mode
 * the explorer uses for New File / New Folder / Rename name entry.
 * Top-center overlay, keyboard-first (Up/Down highlight, Enter accepts,
 * Escape closes), mouse-optional.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '../i18n/ids.ts'
import { useWorkbench } from '../workbench/editor-context.ts'
import { openFileIntoEditor } from '../workbench/open-file.ts'
import { COMMANDS } from './commands.ts'
import { keybindingLabel } from './keybindings.ts'
import { rankBy } from './fuzzy.ts'
import { useT } from '../i18n/I18nProvider.tsx'

/** The quick-input modes: two pickers plus the one-line name prompt. */
export type QuickInputMode =
  | { readonly kind: 'files' }
  | { readonly kind: 'commands' }
  | {
    readonly kind: 'prompt'
    /** Widget title (the header above the input line). */
    readonly title: string
    /** Pre-filled value (the current name when renaming). */
    readonly value: string
    readonly placeholder: string
    /** The entered value, invoked on Enter. */
    readonly accept: (value: string) => void
  }
  | {
    readonly kind: 'select'
    /** Widget title (the header above the input line). */
    readonly title: string
    readonly items: readonly { readonly label: string; readonly value: string }[]
    /** The selected value, invoked on Enter / click. */
    readonly accept: (value: string) => void
  }

/** Props the shell delivers. */
export interface QuickInputProps {
  readonly mode: QuickInputMode
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  /** Dismiss the widget (Escape, overlay click, or after an accepted item). */
  readonly onClose: () => void
  /** Run one command id (the shell closes the widget first). */
  readonly runCommand: (commandId: string) => void
}

/** One renderable candidate row. */
interface QuickItem {
  readonly label: string
  readonly detail: string
  /** Right-aligned affordance (keybinding label, commands only). */
  readonly hint: string | undefined
  readonly accept: () => void
}

/** Row cap — the widget scrolls beyond this. */
const MAX_ROWS = 12

/** The quick-input widget. */
export function QuickInput({ mode, useSessions, onClose, runCommand }: QuickInputProps) {
  const { t } = useT()
  const { fs, editor } = useWorkbench()
  const cwd = useSessions(state => state.current !== undefined ? state.byId[state.current]?.cwd : undefined)
  const [query, setQuery] = useState(mode.kind === 'prompt' ? mode.value : '')
  const [highlight, setHighlight] = useState(0)
  const [workspaceFiles, setWorkspaceFiles] = useState<readonly string[]>([])
  const [filesError, setFilesError] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Fetch the workspace listing once per open (bounded host-side walk).
  useEffect(() => {
    if (mode.kind !== 'files' || cwd === undefined) return
    let disposed = false
    setWorkspaceFiles([])
    setFilesError(undefined)
    void fs.listAll(cwd).then(
      result => { if (!disposed) setWorkspaceFiles(result.files) },
      error => { if (!disposed) setFilesError(error instanceof Error ? error.message : String(error)) },
    )
    return () => { disposed = true }
  }, [mode, cwd, fs])

  const items = useMemo<QuickItem[]>(() => {
    if (mode.kind === 'commands') {
      return COMMANDS.map(command => ({
        label: `${command.category}: ${t(command.title)}`,
        detail: command.id,
        hint: command.binding !== undefined ? keybindingLabel(command.binding.def) : undefined,
        accept: () => { runCommand(command.id) },
      }))
    }
    if (mode.kind === 'files') {
      return workspaceFiles.map(file => ({
        label: file.split('/').pop() ?? file,
        detail: file,
        hint: undefined,
        accept: () => {
          void openFileIntoEditor(fs, editor, file).then(() => { onClose() })
        },
      }))
    }
    if (mode.kind === 'select') {
      return mode.items.map(item => ({
        label: item.label,
        detail: '',
        hint: undefined,
        accept: () => { mode.accept(item.value) },
      }))
    }
    return []
  }, [mode, workspaceFiles, fs, editor, runCommand, onClose, t])

  const ranked = useMemo(
    () => rankBy(query, items, item => `${item.label} ${item.detail}`).slice(0, MAX_ROWS),
    [query, items],
  )

  // A new query resets the highlight to the top row.
  useEffect(() => { setHighlight(0) }, [query])

  useEffect(() => { inputRef.current?.focus() }, [])

  const accept = (index: number): void => {
    const entry = ranked[index]
    if (entry !== undefined) entry.item.accept()
  }

  const promptAccept = (): void => {
    if (mode.kind !== 'prompt') return
    mode.accept(query)
    onClose()
  }

  return (
    <div className="dsh-wb-quickinput-overlay" data-quick-input={mode.kind} onClick={onClose}>
      <div className="dsh-wb-quickinput" onClick={event => { event.stopPropagation() }}>
        {mode.kind === 'prompt' && <div className="dsh-wb-quickinput-title" data-quick-input-title>{mode.title}</div>}
        <input
          ref={inputRef}
          className="dsh-wb-quickinput-input"
          value={query}
          placeholder={mode.kind === 'prompt' ? mode.placeholder : mode.kind === 'files' ? t('cmd.quickOpen.title') : t('cmd.showAllCommands.title')}
          onChange={event => { setQuery(event.target.value) }}
          onKeyDown={event => {
            if (mode.kind === 'prompt') {
              if (event.key === 'Enter') {
                event.preventDefault()
                promptAccept()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHighlight(highlight => Math.min(highlight + 1, ranked.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlight(highlight => Math.max(highlight - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              accept(highlight)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
          data-quick-input-field
        />
        {mode.kind !== 'prompt' && (
          <div className="dsh-wb-quickinput-list" data-quick-input-list>
            {filesError !== undefined && mode.kind === 'files' && (
              <div className="dsh-wb-error" data-quick-input-error>{filesError}</div>
            )}
            {filesError === undefined && ranked.length === 0 && (
              <div className="dsh-wb-placeholder" data-quick-input-empty>
                {mode.kind === 'files' ? t('search.noResults') : t('quickInput.noResults')}
              </div>
            )}
            {ranked.map((entry, index) => (
              <button
                key={`${entry.item.detail}:${index}`}
                type="button"
                className={`dsh-wb-quickitem${index === highlight ? ' dsh-wb-quickitem-active' : ''}`}
                onMouseEnter={() => { setHighlight(index) }}
                onClick={() => { accept(index) }}
                data-quick-item={entry.item.detail}
              >
                <span className="dsh-wb-quickitem-label">{entry.item.label}</span>
                <span className="dsh-wb-quickitem-detail">{entry.item.detail}</span>
                {entry.item.hint !== undefined && <span className="dsh-wb-quickitem-hint">{entry.item.hint}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
