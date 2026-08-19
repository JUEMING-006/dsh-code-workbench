/**
 * Search view: the sidebar's search activity panel. One input, debounced
 * against Enter, results grouped by file with expandable match rows. A row
 * click opens the file through the callback the sidebar wires to the editor
 * store — the view is read-only and owns no editor state itself.
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { FsClient } from '../../fs/client.ts'
import type { SearchMatchView } from '../../../shared/fs-contract.ts'
import { useT } from '../../i18n/I18nProvider.tsx'
import type { MessageId } from '../../i18n/ids.ts'
import { IconSearch } from '../../theme/codicons.tsx'
import { IconCaseSensitive, IconWholeMatch, IconRegex } from '../../theme/codicons.tsx'

/** Props: the fs client plus the workspace root and open-file callback. */
export interface SearchViewProps {
  readonly fs: FsClient
  readonly root: string
  readonly onOpenFile: (path: string) => void
}

/** Group results by file path. */
interface SearchGroup {
  readonly path: string
  readonly matches: readonly SearchMatchView[]
}

/** The search view body. */
export function SearchView({ fs, root, onOpenFile }: SearchViewProps) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<readonly SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeMatch, setWholeMatch] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [replaceQuery, setReplaceQuery] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const runSearch = async (): Promise<void> => {
    const pattern = query.trim()
    if (pattern === '') { setGroups([]); setError(undefined); return }
    setLoading(true)
    setError(undefined)
    try {
      const result = await fs.search({ pattern, root, caseSensitive, wholeMatch, useRegex })
      const map = new Map<string, SearchMatchView[]>()
      for (const match of result.matches) {
        const list = map.get(match.path) ?? []
        list.push(match)
        map.set(match.path, list)
      }
      const next: SearchGroup[] = []
      for (const [path, matches] of map) {
        next.push({ path, matches })
      }
      next.sort((a, b) => a.path.localeCompare(b.path))
      setGroups(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  // Re-search when the workspace root changes.
  useEffect(() => { setGroups([]); setError(undefined) }, [root])

  const toggle = (path: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  const toggleFlag = (setter: (value: boolean) => void, current: boolean): void => {
    setter(!current)
    // Re-run search with new flags after a brief delay.
    setTimeout(() => { void runSearch() }, 50)
  }

  return (
    <div className="dsh-wb-search" data-search-view>
      <div className="dsh-wb-search-inputrow">
        <IconSearch size={16} />
        <input
          ref={inputRef}
          className="dsh-wb-search-input"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value) }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') { event.preventDefault(); void runSearch() }
          }}
          data-search-input
        />
        <div className="dsh-wb-search-toggles" data-search-toggles>
          <button
            type="button"
            className={`dsh-wb-search-toggle${caseSensitive ? ' dsh-wb-search-toggle-active' : ''}`}
            title="Case sensitive"
            aria-pressed={caseSensitive}
            onClick={() => { toggleFlag(setCaseSensitive, caseSensitive) }}
            data-search-toggle="case"
          >
            <IconCaseSensitive size={16} />
          </button>
          <button
            type="button"
            className={`dsh-wb-search-toggle${wholeMatch ? ' dsh-wb-search-toggle-active' : ''}`}
            title="Match whole word"
            aria-pressed={wholeMatch}
            onClick={() => { toggleFlag(setWholeMatch, wholeMatch) }}
            data-search-toggle="whole"
          >
            <IconWholeMatch size={16} />
          </button>
          <button
            type="button"
            className={`dsh-wb-search-toggle${useRegex ? ' dsh-wb-search-toggle-active' : ''}`}
            title="Use regular expression"
            aria-pressed={useRegex}
            onClick={() => { toggleFlag(setUseRegex, useRegex) }}
            data-search-toggle="regex"
          >
            <IconRegex size={16} />
          </button>
        </div>
      </div>
      {showReplace && (
        <div className="dsh-wb-search-replacerow" data-search-replacerow>
          <input
            className="dsh-wb-search-input"
            value={replaceQuery}
            placeholder={t('search.replacePlaceholder')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setReplaceQuery(event.target.value) }}
            data-search-replace-input
          />
          <button
            type="button"
            className="dsh-wb-button-secondary"
            onClick={() => { /* TODO: implement replace */ }}
            data-search-replace="single"
          >
            {t('search.replace')}
          </button>
          <button
            type="button"
            className="dsh-wb-button-secondary"
            onClick={() => { /* TODO: implement replace all */ }}
            data-search-replace="all"
          >
            {t('search.replaceAll')}
          </button>
        </div>
      )}
      <div className="dsh-wb-search-morerow" data-search-morerow>
        <button
          type="button"
          className="dsh-wb-search-more"
          onClick={() => { setShowMore(!showMore) }}
          data-search-more-toggle
        >
          {showMore ? '▼' : '▶'} {t('search.moreOptions')}
        </button>
        {showMore && (
          <div className="dsh-wb-search-morebody" data-search-morebody>
            <div className="dsh-wb-search-optionrow" data-search-optionrow="include">
              <label className="dsh-wb-search-optionlabel" data-search-option-label="include">{t('search.include')}</label>
              <input
                className="dsh-wb-search-input"
                value={include}
                placeholder="e.g. *.ts"
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setInclude(event.target.value) }}
                data-search-include
              />
            </div>
            <div className="dsh-wb-search-optionrow" data-search-optionrow="exclude">
              <label className="dsh-wb-search-optionlabel" data-search-option-label="exclude">{t('search.exclude')}</label>
              <input
                className="dsh-wb-search-input"
                value={exclude}
                placeholder="e.g. **/node_modules/**"
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setExclude(event.target.value) }}
                data-search-exclude
              />
            </div>
          </div>
        )}
      </div>
      {error !== undefined && <div className="dsh-wb-error" data-search-error>{error}</div>}
      {loading && <div className="dsh-wb-placeholder" data-search-loading>Searching…</div>}
      {!loading && groups.length === 0 && query.trim() !== '' && (
        <div className="dsh-wb-placeholder" data-search-empty>No results</div>
      )}
      <div className="dsh-wb-search-results" data-search-results>
        {groups.map(group => {
          const open = expanded.has(group.path)
          return (
            <div key={group.path} className="dsh-wb-search-group" data-search-group={group.path}>
              <button
                type="button"
                className="dsh-wb-search-file"
                aria-expanded={open}
                onClick={() => { toggle(group.path) }}
                data-search-file={group.path}
              >
                <span className="dsh-wb-search-twistie">{open ? '▼' : '▶'}</span>
                <span className="dsh-wb-search-path">{group.path}</span>
                <span className="dsh-wb-search-count" data-search-count>{group.matches.length}</span>
              </button>
              {open && (
                <div className="dsh-wb-search-matches" data-search-matches={group.path}>
                  {group.matches.map((match, index) => (
                    <button
                      key={`${match.line}-${index}`}
                      type="button"
                      className="dsh-wb-search-match"
                      onClick={() => { onOpenFile(match.path) }}
                      data-search-match={`${match.path}:${match.line}`}
                    >
                      <span className="dsh-wb-search-line">{match.line}</span>
                      <span className="dsh-wb-search-text">{match.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
