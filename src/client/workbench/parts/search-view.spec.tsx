/**
 * Search view tests: the activity panel renders an input, runs the search
 * through the fs client, groups hits by file, opens files on row click, and
 * surfaces read-only errors.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FsClient } from '../../fs/client.ts'
import { SearchView } from './SearchView.tsx'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'

/** Fake fs client whose search returns canned matches. */
function fakeFs(matches: Parameters<FsClient['search']>[0] extends { pattern: string } ? { pattern: string; root: string } : never): FsClient {
  const patternRef = matches.pattern
  return {
    listDir: vi.fn(async () => ({ path: '/w', entries: [] })),
    listAll: vi.fn(async () => ({ root: '/w', files: [] })),
    readText: vi.fn(async () => ({ path: '/w/a.txt', content: 'hi', version: 'v1' })),
    writeText: vi.fn(async () => ({ path: '/w/a.txt', version: 'v9' })),
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => {
      if (patternRef === 'needle') {
        return {
          root: '/w',
          pattern: 'needle',
          truncated: false,
          matches: [
            { path: 'a.txt', line: 2, text: 'needle here', before: ['line one'], after: ['more'] },
            { path: 'a.txt', line: 5, text: 'needle again', before: ['after more'], after: [] },
            { path: 'sub/b.txt', line: 1, text: 'needle sub', before: [], after: ['next'] },
          ],
        }
      }
      return { root: '/w', pattern: patternRef, matches: [], truncated: false }
    }),
    replace: vi.fn(async () => ({ path: '', version: '' })),
  } as unknown as FsClient
}

describe('SearchView', () => {
  it('renders the input and the view container', () => {
    render(<I18nProvider><SearchView fs={fakeFs({ pattern: '', root: '/w' })} root="/w" onOpenFile={vi.fn()} /></I18nProvider>)
    expect(document.querySelector('[data-search-view]')).toBeTruthy()
    expect(document.querySelector('[data-search-input]')).toBeTruthy()
  })

  it('runs the search on Enter and renders grouped results', async () => {
    const fs = fakeFs({ pattern: 'needle', root: '/w' })
    const onOpenFile = vi.fn()
    render(<I18nProvider><SearchView fs={fs} root="/w" onOpenFile={onOpenFile} /></I18nProvider>)
    fireEvent.change(document.querySelector('[data-search-input]')!, { target: { value: 'needle' } })
    fireEvent.keyDown(document.querySelector('[data-search-input]')!, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-search-results]')).toBeTruthy())
    expect(fs.search).toHaveBeenCalledWith({ pattern: 'needle', root: '/w', caseSensitive: false, wholeMatch: false, useRegex: false })
    // Two file groups.
    expect(document.querySelectorAll('[data-search-group]')).toHaveLength(2)
    expect(document.querySelector('[data-search-group="a.txt"]')).toBeTruthy()
    expect(document.querySelector('[data-search-group="sub/b.txt"]')).toBeTruthy()
    expect(document.querySelector('[data-search-count]')?.textContent).toBe('2')
  })

  it('opens the file on match row click', async () => {
    const fs = fakeFs({ pattern: 'needle', root: '/w' })
    const onOpenFile = vi.fn()
    render(<I18nProvider><SearchView fs={fs} root="/w" onOpenFile={onOpenFile} /></I18nProvider>)
    fireEvent.change(document.querySelector('[data-search-input]')!, { target: { value: 'needle' } })
    fireEvent.keyDown(document.querySelector('[data-search-input]')!, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-search-group]')).toBeTruthy())
    // Expand the first group to reveal match rows.
    fireEvent.click(document.querySelector('[data-search-file]')!)
    await waitFor(() => expect(document.querySelector('[data-search-match]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-search-match]')!)
    expect(onOpenFile).toHaveBeenCalledWith('a.txt')
  })

  it('surfaces search errors', async () => {
    const fs = {
      ...fakeFs({ pattern: 'x', root: '/w' }),
      search: vi.fn(async () => { throw new Error('search down') }),
    } as unknown as FsClient
    render(<I18nProvider><SearchView fs={fs} root="/w" onOpenFile={vi.fn()} /></I18nProvider>)
    fireEvent.change(document.querySelector('[data-search-input]')!, { target: { value: 'x' } })
    fireEvent.keyDown(document.querySelector('[data-search-input]')!, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-search-error]')?.textContent).toContain('search down'))
  })

  it('shows the empty state when the query yields no matches', async () => {
    const fs = fakeFs({ pattern: 'nope', root: '/w' })
    render(<I18nProvider><SearchView fs={fs} root="/w" onOpenFile={vi.fn()} /></I18nProvider>)
    fireEvent.change(document.querySelector('[data-search-input]')!, { target: { value: 'nope' } })
    fireEvent.keyDown(document.querySelector('[data-search-input]')!, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-search-empty]')).toBeTruthy())
  })
})