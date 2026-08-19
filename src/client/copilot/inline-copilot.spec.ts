/**
 * Tests for the client-side inline Copilot driver.
 */

import { describe, expect, it, vi } from 'vitest'
import type * as Monaco from 'monaco-editor'
import { registerInlineCopilot } from './inline-copilot.ts'

describe('registerInlineCopilot', () => {
  it('registers inline completions provider with monaco', async () => {
    let registeredProvider: Monaco.languages.InlineCompletionsProvider | null = null
    const mockMonaco = {
      languages: {
        getLanguages: () => [{ id: 'python' }, { id: 'javascript' }],
        registerInlineCompletionsProvider: vi.fn((_selector, provider) => {
          registeredProvider = provider
          return { dispose: vi.fn() }
        }),
        registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
      },
      Range: class {
        constructor(readonly startLineNumber: number, readonly startColumn: number, readonly endLineNumber: number, readonly endColumn: number) {}
      },
    } as unknown as typeof Monaco

    const disposable = registerInlineCopilot(mockMonaco)
    expect(mockMonaco.languages.registerInlineCompletionsProvider).toHaveBeenCalledWith('*', expect.any(Object))
    expect(registeredProvider).not.toBeNull()

    // Test provideInlineCompletions with empty prefix
    const mockModel = {
      getOffsetAt: () => 0,
      getValue: () => '',
      getLanguageId: () => 'python',
      uri: { path: '/test.py' },
    } as unknown as Monaco.editor.ITextModel

    const mockToken = {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(),
    } as unknown as Monaco.CancellationToken

    const result = await registeredProvider!.provideInlineCompletions(
      mockModel,
      { lineNumber: 1, column: 1 } as Monaco.Position,
      {} as Monaco.languages.InlineCompletionContext,
      mockToken,
    )

    expect(result).toEqual({ items: [] })
    disposable.dispose()
  })
})
