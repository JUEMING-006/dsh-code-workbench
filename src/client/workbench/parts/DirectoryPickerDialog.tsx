/**
 * In-App Directory Picker Modal (Enterprise Web IDE Project Chooser).
 * Provides visual folder navigation, directory tree browsing, parent
 * navigation, drive/quick jump shortcuts, and folder selection.
 */

import { useEffect, useState, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { FsClient } from '../../fs/client.ts'
import type { FsEntryView } from '../../../shared/fs-contract.ts'
import { dirnameOf } from '../../fs/client.ts'
import { useT } from '../../i18n/I18nProvider.tsx'
import { IconFolder, IconFolderOpened, IconClose, IconChevronRight } from '../../theme/codicons.tsx'

export interface DirectoryPickerDialogProps {
  readonly initialPath: string
  readonly fs: FsClient
  readonly onSelect: (path: string) => void
  readonly onClose: () => void
}

/** Standard quick jump bookmarks for fast navigation across drives and workspace. */
const QUICK_BOOKMARKS = [
  { label: 'deepseek-harness', path: 'D:\\deepseek-harness' },
  { label: 'D 盘 (D:\\)', path: 'D:\\' },
  { label: 'C 盘 (C:\\)', path: 'C:\\' },
  { label: 'D:\\Users', path: 'D:\\Users' },
  { label: 'C:\\Users', path: 'C:\\Users' },
]

/** Normalize Windows drive roots like "D:" or "D:/" to "D:\" so stat and readdir succeed. */
function normalizeDirPath(raw: string): string {
  let trimmed = raw.trim()
  if (trimmed.length === 0) return trimmed
  trimmed = trimmed.replace(/^\/([a-zA-Z]:)/u, '$1')
  if (/^[a-zA-Z]:$/u.test(trimmed)) {
    return `${trimmed.toUpperCase()}\\`
  }
  if (/^[a-zA-Z]:[/\\]$/u.test(trimmed)) {
    return `${trimmed.charAt(0).toUpperCase()}:\\`
  }
  return trimmed
}

/** Join base directory and child folder safely with correct separator. */
function joinPath(base: string, child: string): string {
  const norm = normalizeDirPath(base)
  if (norm.endsWith('\\') || norm.endsWith('/')) {
    return `${norm}${child}`
  }
  const sep = norm.includes('/') && !norm.includes('\\') ? '/' : '\\'
  return `${norm}${sep}${child}`
}

export function DirectoryPickerDialog({
  initialPath,
  fs,
  onSelect,
  onClose,
}: DirectoryPickerDialogProps) {
  const { t } = useT()
  const [currentPath, setCurrentPath] = useState(normalizeDirPath(initialPath))
  const [pathInput, setPathInput] = useState(normalizeDirPath(initialPath))
  const [filterText, setFilterText] = useState('')
  const [entries, setEntries] = useState<readonly FsEntryView[]>([])
  const [selectedPath, setSelectedPath] = useState<string>(normalizeDirPath(initialPath))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const listRef = useRef<HTMLDivElement>(null)

  const loadDirectory = (target: string, isRetryFallback = false) => {
    const normalized = normalizeDirPath(target)
    if (normalized.length === 0) return
    setLoading(true)
    setError(undefined)
    fs.listDir(normalized).then(
      (result) => {
        const dirsOnly = result.entries
          .filter(e => e.type === 'directory')
          .sort((a, b) => a.name.localeCompare(b.name))
        setEntries(dirsOnly)
        setCurrentPath(normalized)
        setPathInput(normalized)
        setSelectedPath(normalized)
        setLoading(false)
      },
      (err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err)
        setError(errMsg)
        setLoading(false)
        if (!isRetryFallback) {
          const parent = dirnameOf(normalized)
          if (parent.length > 0 && normalizeDirPath(parent) !== normalized) {
            loadDirectory(parent, true)
          } else if (normalized !== 'D:\\') {
            loadDirectory('D:\\', true)
          }
        }
      },
    )
  }

  useEffect(() => {
    loadDirectory(initialPath)
  }, [fs, initialPath])

  const handleNavigateUp = () => {
    const normalized = normalizeDirPath(currentPath)
    if (/^[a-zA-Z]:[/\\]?$/u.test(normalized)) {
      return
    }
    let parent = dirnameOf(normalized)
    parent = normalizeDirPath(parent)
    if (parent.length > 0 && parent !== normalized) {
      loadDirectory(parent)
    } else {
      const driveMatch = /^[a-zA-Z]:/u.exec(normalized)
      if (driveMatch !== null) {
        loadDirectory(`${driveMatch[0].toUpperCase()}:\\`)
      }
    }
  }

  const handleRowDoubleClick = (entryName: string) => {
    const nextPath = joinPath(currentPath, entryName)
    loadDirectory(nextPath)
  }

  const handleRowClick = (entryName: string) => {
    const target = joinPath(currentPath, entryName)
    setSelectedPath(target)
  }

  const handleConfirm = () => {
    const target = selectedPath || currentPath
    if (target.trim().length > 0) {
      onSelect(normalizeDirPath(target.trim()))
      onClose()
    }
  }

  const filteredEntries = filterText.trim().length === 0
    ? entries
    : entries.filter(e => e.name.toLowerCase().includes(filterText.trim().toLowerCase()))

  const canNavigateUp = (dirnameOf(currentPath).length > 0 && normalizeDirPath(dirnameOf(currentPath)) !== currentPath)
    || (currentPath.length > 3 && /^[a-zA-Z]:[/\\]/u.test(currentPath))

  // Compute breadcrumb path segments for quick navigation
  const normalizedForBreadcrumbs = normalizeDirPath(currentPath)
  const isWindows = /^[a-zA-Z]:/u.test(normalizedForBreadcrumbs)
  const pathParts = normalizedForBreadcrumbs.split(/[/\\]/u).filter(Boolean)

  return (
    <div
      className="dsh-wb-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      data-directory-picker-dialog
    >
      <div className="dsh-wb-dialog-card" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="dsh-wb-dialog-header">
          <div className="dsh-wb-dialog-header-title">
            <span className="dsh-wb-fileicon dsh-wb-fileicon-folder">
              <IconFolderOpened size={16} />
            </span>
            <span>{t('explorer.openFolder')}</span>
          </div>
          <button
            type="button"
            className="dsh-wb-dialog-close"
            onClick={onClose}
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Quick Jump Bookmarks Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--dsh-wb-editorGroupHeader-tabsBackground)', borderBottom: '1px solid var(--dsh-wb-widget-border)', fontSize: '11px', flexWrap: 'wrap' }}>
          <span style={{ opacity: 0.7 }}>驱动器 / 快捷目录:</span>
          {QUICK_BOOKMARKS.map(bm => (
            <button
              key={bm.path}
              type="button"
              className="dsh-wb-button"
              onClick={() => loadDirectory(bm.path)}
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              {bm.label}
            </button>
          ))}
        </div>

        {/* Path Navigation Bar */}
        <div className="dsh-wb-dialog-nav">
          <button
            type="button"
            className="dsh-wb-button"
            onClick={handleNavigateUp}
            disabled={!canNavigateUp}
            title="上一级 (Up)"
            style={{ padding: '3px 8px', fontSize: '12px' }}
          >
            ↑ 上一级
          </button>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') loadDirectory(pathInput)
            }}
            placeholder="输入或粘贴目录路径..."
            data-path-input
          />
          <button
            type="button"
            className="dsh-wb-button"
            onClick={() => loadDirectory(pathInput)}
            style={{ padding: '3px 8px', fontSize: '12px' }}
          >
            前往
          </button>
        </div>

        {/* Breadcrumbs Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--dsh-wb-sideBar-background)', borderBottom: '1px solid var(--dsh-wb-widget-border)', fontSize: '11.5px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span style={{ opacity: 0.6, marginRight: '2px' }}>位置:</span>
          {pathParts.map((part, index) => {
            const reconstructed = isWindows
              ? index === 0 ? `${part}\\` : `${pathParts.slice(0, index + 1).join('\\')}`
              : `/${pathParts.slice(0, index + 1).join('/')}`
            const isLast = index === pathParts.length - 1

            return (
              <span key={reconstructed} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => loadDirectory(reconstructed)}
                  style={{
                    background: isLast ? 'var(--dsh-wb-button-background)' : 'transparent',
                    color: isLast ? 'var(--dsh-wb-button-foreground)' : 'var(--dsh-wb-textLink-foreground)',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: isLast ? 600 : 400,
                    transition: 'opacity 0.1s ease',
                  }}
                  title={`前往 ${reconstructed}`}
                >
                  {part}
                </button>
                {!isLast && <span style={{ opacity: 0.4, fontSize: '10px' }}>›</span>}
              </span>
            )
          })}
        </div>

        {/* Quick Filter Bar */}
        <div style={{ padding: '4px 12px', background: 'var(--dsh-wb-sideBar-background)', borderBottom: '1px solid var(--dsh-wb-widget-border)' }}>
          <input
            type="text"
            className="dsh-wb-input"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="过滤当前目录下的子文件夹..."
            style={{ width: '100%', padding: '3px 8px', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Directory List View */}
        <div className="dsh-wb-dialog-list" ref={listRef} data-directory-list>
          {loading && (
            <div className="dsh-wb-placeholder">
              <span>正在读取目录内容…</span>
            </div>
          )}
          {error !== undefined && !loading && entries.length === 0 && (
            <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="dsh-wb-error">
                <span>读取失败: {error}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="dsh-wb-button"
                  onClick={() => loadDirectory('D:\\')}
                >
                  前往 D 盘根目录
                </button>
                <button
                  type="button"
                  className="dsh-wb-button"
                  onClick={() => loadDirectory('D:\\deepseek-harness')}
                >
                  前往 deepseek-harness
                </button>
              </div>
            </div>
          )}
          {!loading && error === undefined && filteredEntries.length === 0 && (
            <div className="dsh-wb-placeholder">
              <span>当前路径下无更多子文件夹</span>
            </div>
          )}
          {!loading && filteredEntries.map((entry) => {
            const fullPath = joinPath(currentPath, entry.name)
            const isSelected = selectedPath === fullPath

            return (
              <button
                key={entry.name}
                type="button"
                className="dsh-wb-dialog-row"
                data-selected={isSelected}
                onClick={() => handleRowClick(entry.name)}
                onDoubleClick={() => handleRowDoubleClick(entry.name)}
              >
                <span className="dsh-wb-fileicon dsh-wb-fileicon-folder">
                  <IconFolder size={16} />
                </span>
                <span className="dsh-wb-dialog-row-name">{entry.name}</span>
                <span style={{ opacity: 0.5, fontSize: '11px' }}>
                  <IconChevronRight size={12} />
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="dsh-wb-dialog-footer">
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
            <span>已选路径: </span>
            <span style={{ fontWeight: 600, color: 'var(--dsh-wb-textLink-foreground)' }}>{selectedPath || currentPath}</span>
          </div>
          <div className="dsh-wb-dialog-footer-actions">
            <button
              type="button"
              className="dsh-wb-button"
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="dsh-wb-button dsh-wb-button-primary"
              onClick={handleConfirm}
              data-confirm-open-folder
            >
              选择此文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
