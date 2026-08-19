/**
 * Editor surfaces: the pluggable text-editing body of the editor area.
 *
 * The Monaco surface is the production editor — it loads the distribution at
 * runtime (see load-monaco.ts), so the plugin bundle stays small. The
 * textarea surface is the test/fallback stand-in with identical behavior.
 * EditorArea picks its surface from the workbench services (Monaco by
 * default, injectable for tests).
 */

import { useEffect, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { loadMonaco } from './load-monaco.ts'
import { registerInlineCopilot } from '../copilot/inline-copilot.ts'
import { InlineEditWidget } from '../copilot/InlineEditWidget.tsx'
import { findSymbolInContent } from './symbols.ts'

let definitionProviderRegistered = false

function registerDefinitionProviders(monaco: typeof Monaco) {
  if (definitionProviderRegistered) return
  definitionProviderRegistered = true

  const languages = ['python', 'typescript', 'javascript', 'rust', 'go', 'markdown', 'json']
  for (const lang of languages) {
    monaco.languages.registerDefinitionProvider(lang, {
      provideDefinition: (model, position) => {
        const wordInfo = model.getWordAtPosition(position)
        if (!wordInfo || !wordInfo.word) return null
        const word = wordInfo.word
        const content = model.getValue()
        const found = findSymbolInContent(word, content, model.uri.path)
        if (found) {
          return {
            uri: model.uri,
            range: new monaco.Range(found.line, found.col, found.line, found.col),
          }
        }
        return null
      },
    })
  }
}

interface InlineEditState {
  top: number
  left: number
  width: number
  selectedCode: string
  startLine: number
  endLine: number
  selectionStartOffset: number
  selectionEndOffset: number
  selectionRange: Monaco.Range
}

/** The editing contract every surface honors. */
export interface EditorSurfaceProps {
  /** Display path of the open file (drives language detection). */
  readonly path: string
  readonly content: string
  /** Explicit language override if selected by user (e.g. 'typescript'). */
  readonly language?: string | undefined
  readonly onChange: (content: string) => void
  /**
   * Cursor/selection moved: 1-based line/column of the focus end (status-bar
   * Ln/Col) plus the selected text ('' for a collapsed cursor).
   */
  readonly onSelectionChange?: (line: number, col: number, text: string) => void
  /** Monaco theme override ('vs-dark' / 'vs' / 'hc-black'); absent defaults to 'vs-dark'. */
  readonly theme?: 'vs-dark' | 'vs' | 'hc-black'
  /** Whether the minimap is enabled; absent defaults to true. */
  readonly minimapEnabled?: boolean
}

/** Extension → monaco language id. */
export const LANGUAGE_BY_EXT: Readonly<Record<string, string>> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  vue: 'html',
  svelte: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  pyw: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  graphql: 'graphql',
  gql: 'graphql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  bat: 'bat',
  cmd: 'bat',
  xml: 'xml',
  svg: 'xml',
  sql: 'sql',
  toml: 'ini',
  ini: 'ini',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
  txt: 'plaintext',
  log: 'plaintext',
}

/** Special filenames → monaco language id. */
export const LANGUAGE_BY_FILENAME: Readonly<Record<string, string>> = {
  dockerfile: 'dockerfile',
  makefile: 'shell',
  cmakelists: 'shell',
  '.gitignore': 'ini',
  '.npmrc': 'ini',
  '.env': 'ini',
  'package.json': 'json',
  'tsconfig.json': 'json',
}

/** Language id → human-readable display label (status bar name). */
export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  rust: 'Rust',
  go: 'Go',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  shell: 'Shell Script',
  powershell: 'PowerShell',
  sql: 'SQL',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
  lua: 'Lua',
  r: 'R',
  dart: 'Dart',
  graphql: 'GraphQL',
  protobuf: 'Protocol Buffer',
  dockerfile: 'Dockerfile',
  ini: 'INI / Config',
  bat: 'Batch',
  plaintext: 'Plain Text',
}

/** Get human-readable language label from language id or file path. */
export function languageLabelOf(langOrPath: string): string {
  if (langOrPath in LANGUAGE_NAMES) return LANGUAGE_NAMES[langOrPath] ?? langOrPath
  const langId = languageOf(langOrPath)
  return LANGUAGE_NAMES[langId] ?? langId
}

/** Map a file path to its monaco language id (plaintext fallback). */
export function languageOf(path: string): string {
  const filename = path.split(/[/\\]/u).filter(Boolean).pop()?.toLowerCase() ?? path.toLowerCase()
  if (filename in LANGUAGE_BY_FILENAME) {
    return LANGUAGE_BY_FILENAME[filename] ?? 'plaintext'
  }
  const dot = path.lastIndexOf('.')
  if (dot < 0) return 'plaintext'
  return LANGUAGE_BY_EXT[path.slice(dot + 1).toLowerCase()] ?? 'plaintext'
}

/**
 * Monaco surface: one standalone editor per mounted tab. The editor is
 * created once; external content/path changes sync into it, and edits flow
 * out through onChange (guarded against echo loops by value comparison).
 */
export function MonacoEditorSurface({ path, content, language, onChange, onSelectionChange, theme, minimapEnabled }: EditorSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const initialContentRef = useRef(content)
  const themeRef = useRef(theme)
  const minimapEnabledRef = useRef(minimapEnabled)
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null)

  useEffect(() => {
    let disposed = false
    void loadMonaco().then((monaco) => {
      if (disposed || hostRef.current === null) return
      const initialLang = language ?? languageOf(path)
      const editor = monaco.editor.create(hostRef.current, {
        value: initialContentRef.current,
        language: initialLang,
        theme: themeRef.current ?? 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: minimapEnabledRef.current ?? true },
        fontSize: 13,
        tabSize: 2,
        wordWrap: 'off',
        scrollBeyondLastLine: false,
        inlineSuggest: { enabled: true, showToolbar: 'always' },
        suggest: { preview: true, showInlineDetails: true },
        quickSuggestions: { other: true, comments: true, strings: true },
      })
      registerInlineCopilot(monaco)
      registerDefinitionProviders(monaco)
      editor.addAction({
        id: 'copilot.triggerInlineCompletion',
        label: 'Trigger Inline Copilot Suggestion',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Backslash],
        run: (ed) => {
          ed.trigger('copilot', 'editor.action.inlineSuggest.trigger', {})
        },
      })
      editor.addAction({
        id: 'copilot.inlineEdit',
        label: 'AI Inline Edit (Ctrl+K)',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        run: (ed) => {
          const model = ed.getModel()
          if (!model) return
          let selection = ed.getSelection()
          if (!selection || (selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn)) {
            const pos = ed.getPosition() ?? { lineNumber: 1, column: 1 }
            selection = new monaco.Selection(
              pos.lineNumber,
              1,
              pos.lineNumber,
              model.getLineMaxColumn(pos.lineNumber),
            )
            ed.setSelection(selection)
          }
          const selectedCode = model.getValueInRange(selection)
          const startOffset = model.getOffsetAt({ lineNumber: selection.startLineNumber, column: selection.startColumn })
          const endOffset = model.getOffsetAt({ lineNumber: selection.endLineNumber, column: selection.endColumn })
          const scrolledPos = ed.getScrolledVisiblePosition({ lineNumber: selection.startLineNumber, column: selection.startColumn })
          const domNode = ed.getDomNode()
          const width = domNode?.clientWidth ?? 600

          setInlineEdit({
            top: (scrolledPos?.top ?? 40) + 24,
            left: Math.max(20, Math.min(scrolledPos?.left ?? 60, width - 460)),
            width,
            selectedCode,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            selectionStartOffset: startOffset,
            selectionEndOffset: endOffset,
            selectionRange: selection,
          })
        },
      })
      editor.onDidChangeModelContent(() => {
        onChangeRef.current(editor.getValue())
      })
      editor.onDidChangeCursorSelection((event) => {
        const selection = event.selection
        onSelectionChangeRef.current?.(
          selection.positionLineNumber,
          selection.positionColumn,
          editor.getModel()?.getValueInRange(selection) ?? '',
        )
      })
      editorRef.current = editor
      monacoRef.current = monaco
    })
    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
      monacoRef.current = null
    }
    // Mount once per tab identity; the sync effects below own all updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External content changes (tab switch, revert) sync into the editor.
  useEffect(() => {
    const editor = editorRef.current
    if (editor !== null && editor.getValue() !== content) editor.setValue(content)
  }, [content])

  // Path or language changes re-detect and update the language.
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor?.getModel()
    if (monaco !== null && editor !== null && model !== undefined && model !== null) {
      const nextLang = language ?? languageOf(path)
      monaco.editor.setModelLanguage(model, nextLang)
    }
  }, [path, language])

  // Theme changes: Monaco requires the setTheme API, not editor option updates.
  useEffect(() => {
    const monaco = monacoRef.current
    if (monaco !== null) {
      monaco.editor.setTheme(theme ?? 'vs-dark')
    }
  }, [theme])

  // Minimap changes: update the editor option reactively.
  useEffect(() => {
    const editor = editorRef.current
    if (editor !== null) {
      editor.updateOptions({ minimap: { enabled: minimapEnabled ?? true } })
    }
  }, [minimapEnabled])

  const handleAcceptInlineEdit = (replacement: string) => {
    const editor = editorRef.current
    if (editor && inlineEdit) {
      editor.executeEdits('inline-edit', [
        {
          range: inlineEdit.selectionRange,
          text: replacement,
          forceMoveMarkers: true,
        },
      ])
      editor.pushUndoStop()
      editor.focus()
    }
    setInlineEdit(null)
  }

  const handleCloseInlineEdit = () => {
    setInlineEdit(null)
    editorRef.current?.focus()
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} data-monaco-surface={path} />
      {inlineEdit && (
        <InlineEditWidget
          top={inlineEdit.top}
          left={inlineEdit.left}
          width={inlineEdit.width}
          selectedCode={inlineEdit.selectedCode}
          startLine={inlineEdit.startLine}
          endLine={inlineEdit.endLine}
          path={path}
          language={language ?? languageOf(path)}
          documentText={content}
          selectionStartOffset={inlineEdit.selectionStartOffset}
          selectionEndOffset={inlineEdit.selectionEndOffset}
          onAccept={handleAcceptInlineEdit}
          onClose={handleCloseInlineEdit}
        />
      )}
    </div>
  )
}

/**
 * Textarea surface: the deterministic stand-in (tests, no-monaco fallback).
 * Mirrors the Monaco surface contract exactly.
 */
export function TextareaEditorSurface({ path, content, onChange, onSelectionChange }: EditorSurfaceProps) {
  return (
    <textarea
      className="dsh-wb-editorsurface"
      value={content}
      spellCheck={false}
      onChange={(event) => { onChange(event.target.value) }}
      onSelect={(event) => {
        const start = event.currentTarget.selectionStart
        const end = event.currentTarget.selectionEnd
        const before = content.slice(0, end)
        const lines = before.split('\n')
        onSelectionChange?.(
          lines.length,
          (lines[lines.length - 1]?.length ?? 0) + 1,
          content.slice(start, end),
        )
      }}
      data-editor-input={path}
    />
  )
}
