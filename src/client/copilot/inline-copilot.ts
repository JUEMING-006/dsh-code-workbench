/**
 * Client-side inline Copilot driver for Monaco Editor:
 * Registers an inline completions provider that talks to the host completion gateway,
 * providing Cursor-style ghost text code predictions with Tab to accept.
 */

import type * as Monaco from 'monaco-editor'
import { COPILOT_ROUTE_PATH } from '../../shared/fs-contract.ts'
import type { CopilotCompletionRequest, CopilotCompletionResponse } from '../../shared/fs-contract.ts'

export interface InlineCopilotOptions {
  /** Dynamic check whether Copilot is enabled. Defaults to true. */
  isEnabled?: () => boolean
  /** Debounce wait in milliseconds before issuing the request. Defaults to 250ms. */
  debounceMs?: number
  /** Gateway endpoint override for testing. */
  endpoint?: string
}

interface CacheEntry {
  prefix: string
  completion: string
  timestamp: number
}

const completionCache = new Map<string, CacheEntry>()
let lastSuggested: { prefix: string; completion: string } | null = null

function getCachedCompletion(key: string, prefix: string): string | null {
  const entry = completionCache.get(key)
  if (entry && entry.prefix === prefix && Date.now() - entry.timestamp < 60000) {
    return entry.completion
  }
  if (
    lastSuggested &&
    prefix.startsWith(lastSuggested.prefix) &&
    lastSuggested.completion.length > 0
  ) {
    const typedDelta = prefix.slice(lastSuggested.prefix.length)
    if (lastSuggested.completion.startsWith(typedDelta)) {
      return lastSuggested.completion.slice(typedDelta.length)
    }
  }
  return null
}

function setCachedCompletion(key: string, prefix: string, completion: string): void {
  if (completionCache.size > 200) {
    const firstKey = completionCache.keys().next().value
    if (firstKey) completionCache.delete(firstKey)
  }
  completionCache.set(key, { prefix, completion, timestamp: Date.now() })
  lastSuggested = { prefix, completion }
}

let activeProviderDisposable: Monaco.IDisposable | null = null

/**
 * Register the global inline completions provider for Monaco.
 * Safe to call multiple times (disposes previous provider).
 */
export function registerInlineCopilot(
  monaco: typeof Monaco,
  options: InlineCopilotOptions = {},
): Monaco.IDisposable {
  if (activeProviderDisposable !== null) {
    activeProviderDisposable.dispose()
    activeProviderDisposable = null
  }

  const isEnabled = options.isEnabled ?? (() => true)
  const endpoint = options.endpoint ?? COPILOT_ROUTE_PATH

  const provider: Monaco.languages.InlineCompletionsProvider = {
    provideInlineCompletions: async (model, position, _context, token) => {
      if (!isEnabled()) return { items: [] }
      if (token.isCancellationRequested) return { items: [] }

      const offset = model.getOffsetAt(position)
      const fullText = model.getValue()
      const prefix = fullText.slice(0, offset)
      const suffix = fullText.slice(offset)

      if (prefix.trim().length === 0) return { items: [] }

      const cacheKey = `${model.uri.path}:${offset}`
      const cached = getCachedCompletion(cacheKey, prefix)
      if (cached !== null && cached.trim().length > 0) {
        const maxCol = model.getLineMaxColumn(position.lineNumber)
        return {
          items: [
            {
              insertText: cached,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                maxCol,
              ),
            },
          ],
        }
      }

      const request: CopilotCompletionRequest = {
        prefix,
        suffix,
        language: model.getLanguageId(),
        path: model.uri.path,
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        if (!response.ok || token.isCancellationRequested) return { items: [] }

        const data = await response.json() as CopilotCompletionResponse
        if (!data.ok || !data.completion || data.completion.trim().length === 0) {
          return { items: [] }
        }

        setCachedCompletion(cacheKey, prefix, data.completion)

        const maxCol = model.getLineMaxColumn(position.lineNumber)
        const item: Monaco.languages.InlineCompletion = {
          insertText: data.completion,
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            maxCol,
          ),
        }

        return { items: [item] }
      } catch (err) {
        console.warn('[Copilot] Fetch error:', err)
        return { items: [] }
      }
    },
    freeInlineCompletions: () => {},
  }

  const completionItemProvider: Monaco.languages.CompletionItemProvider = {
    triggerCharacters: [':', '.', '(', ' ', '\n'],
    provideCompletionItems: async (model, position) => {
      const offset = model.getOffsetAt(position)
      const fullText = model.getValue()
      const prefix = fullText.slice(0, offset)
      if (prefix.trim().length === 0) return { suggestions: [] }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix,
            suffix: fullText.slice(offset),
            language: model.getLanguageId(),
            path: model.uri.path,
          }),
        })
        if (!response.ok) return { suggestions: [] }
        const data = await response.json() as CopilotCompletionResponse
        if (!data.ok || !data.completion) return { suggestions: [] }

        return {
          suggestions: [
            {
              label: '✨ Copilot AI Completion',
              kind: 14 /* Snippet */,
              detail: 'AI code prediction (Tab/Enter to accept)',
              documentation: data.completion,
              insertText: data.completion,
              sortText: '0000',
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                model.getLineMaxColumn(position.lineNumber),
              ),
            },
          ],
        }
      } catch {
        return { suggestions: [] }
      }
    },
  }

  const disposables: Monaco.IDisposable[] = []
  const allLangs = monaco.languages.getLanguages().map(l => l.id)
  for (const lang of allLangs) {
    disposables.push(monaco.languages.registerInlineCompletionsProvider(lang, provider))
    disposables.push(monaco.languages.registerCompletionItemProvider(lang, completionItemProvider))
  }
  disposables.push(monaco.languages.registerInlineCompletionsProvider('*', provider))
  disposables.push(monaco.languages.registerCompletionItemProvider('*', completionItemProvider))

  activeProviderDisposable = {
    dispose: () => {
      for (const d of disposables) d.dispose()
    },
  }
  return activeProviderDisposable
}
