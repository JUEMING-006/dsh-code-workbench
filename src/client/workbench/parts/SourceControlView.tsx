/**
 * Source Control View: Git staging, commit message box, changed files list,
 * diff triggering, and discard changes.
 */

import { useEffect, useState, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import type { GitClient, GitFileChange, GitStatusResult } from '../../git/client.ts'
import { useWorkbench } from '../editor-context.ts'
import { basenameOf } from '../../fs/client.ts'
import {
  IconAdd, IconCheck, IconClose, IconDiscard, IconGitBranch, IconRefresh,
} from '../../theme/codicons.tsx'
import { useT } from '../../i18n/I18nProvider.tsx'

export interface SourceControlViewProps {
  readonly git: GitClient
  readonly root: string
}

function statusColor(status: string): string {
  switch (status) {
    case 'M': return 'var(--dsh-wb-gitDecoration-modifiedResourceForeground)'
    case 'A':
    case '?': return 'var(--dsh-wb-gitDecoration-untrackedResourceForeground)'
    case 'D': return 'var(--dsh-wb-gitDecoration-deletedResourceForeground)'
    case 'R': return 'var(--dsh-wb-gitDecoration-renamedResourceForeground)'
    default: return 'var(--dsh-wb-foreground)'
  }
}

export function SourceControlView({ git, root }: SourceControlViewProps) {
  const { editor } = useWorkbench()
  const { t } = useT()
  const [status, setStatus] = useState<GitStatusResult | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const res = await git.status(root)
      setStatus(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [git, root])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openDiff = async (change: GitFileChange): Promise<void> => {
    try {
      const { original, modified } = await git.diff(root, change.path, change.staged)
      const diffTitle = `${basenameOf(change.path)} (${change.staged ? 'Index' : 'Working Tree'})`
      editor.actions.openTab({
        path: change.path,
        kind: 'diff',
        originalContent: original,
        content: modified,
        diffTitle,
        version: undefined,
        dirty: false,
        preview: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleStage = async (path: string): Promise<void> => {
    try {
      await git.stage(root, [path])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUnstage = async (path: string): Promise<void> => {
    try {
      await git.unstage(root, [path])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDiscard = async (path: string): Promise<void> => {
    try {
      await git.discard(root, [path])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleStageAll = async (): Promise<void> => {
    try {
      await git.stage(root, [])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUnstageAll = async (): Promise<void> => {
    try {
      await git.unstage(root, [])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCommit = async (): Promise<void> => {
    const msg = commitMessage.trim()
    if (msg === '' || committing) return
    setCommitting(true)
    setError(undefined)
    try {
      if ((status?.staged.length ?? 0) === 0 && (status?.unstaged.length ?? 0) > 0) {
        await git.stage(root, [])
      }
      await git.commit(root, msg)
      setCommitMessage('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCommitting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleCommit()
    }
  }

  if (status !== undefined && !status.isRepo) {
    return (
      <div className="dsh-wb-placeholder" data-scm-not-repo>
        <div>{t('activity.scm')}</div>
        <div className="dsh-wb-placeholder-hint">当前工作区非 Git 仓库</div>
      </div>
    )
  }

  const stagedCount = status?.staged.length ?? 0
  const unstagedCount = status?.unstaged.length ?? 0
  const canCommit = commitMessage.trim().length > 0 && (stagedCount > 0 || unstagedCount > 0)

  return (
    <div className="dsh-wb-scm-view" data-scm-view style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', overflowY: 'auto' }}>
      {/* Branch & Refresh row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', opacity: 0.85 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconGitBranch size={14} />
          <span data-scm-branch>{status?.branch ?? 'HEAD'}</span>
          {status?.tracking !== undefined && (
            <span style={{ opacity: 0.6 }}>({status.tracking})</span>
          )}
        </div>
        <button
          type="button"
          className="dsh-wb-actionicon"
          title="刷新"
          aria-label="刷新"
          onClick={() => { void refresh() }}
          disabled={loading}
        >
          <IconRefresh size={14} />
        </button>
      </div>

      {/* Commit message input box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <textarea
          className="dsh-wb-input"
          style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px', padding: '6px', boxSizing: 'border-box' }}
          placeholder="输入提交信息 (Ctrl+Enter 提交)"
          value={commitMessage}
          onChange={e => { setCommitMessage(e.target.value) }}
          onKeyDown={handleKeyDown}
          data-scm-commit-input
        />
        <button
          type="button"
          className="dsh-wb-button-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', fontSize: '12px' }}
          disabled={!canCommit || committing}
          onClick={() => { void handleCommit() }}
          data-scm-commit-button
        >
          <IconCheck size={14} />
          <span>{committing ? '提交中...' : '提交 (Commit)'}</span>
        </button>
      </div>

      {error !== undefined && (
        <div className="dsh-wb-error" style={{ fontSize: '12px' }} data-scm-error>{error}</div>
      )}

      {/* Staged Changes Group */}
      {stagedCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.7, padding: '4px 0' }}>
            <span>暂存的更改 ({stagedCount})</span>
            <button
              type="button"
              className="dsh-wb-actionicon"
              title="取消暂存所有更改"
              aria-label="取消暂存所有更改"
              onClick={() => { void handleUnstageAll() }}
            >
              <IconClose size={14} />
            </button>
          </div>
          {status?.staged.map(change => (
            <div
              key={`staged:${change.path}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', fontSize: '12px', cursor: 'pointer', borderRadius: '3px' }}
              className="dsh-wb-scm-item"
              onClick={() => { void openDiff(change) }}
              data-scm-staged-file={change.path}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span>{basenameOf(change.path)}</span>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{change.path}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: statusColor(change.status), fontWeight: 'bold', fontSize: '11px' }}>
                  {change.status}
                </span>
                <button
                  type="button"
                  className="dsh-wb-actionicon"
                  title="取消暂存"
                  aria-label="取消暂存"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleUnstage(change.path)
                  }}
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Changes Group (Unstaged) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.7, padding: '4px 0' }}>
          <span>更改 ({unstagedCount})</span>
          {unstagedCount > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title="暂存所有更改"
                aria-label="暂存所有更改"
                onClick={() => { void handleStageAll() }}
              >
                <IconAdd size={14} />
              </button>
            </div>
          )}
        </div>
        {unstagedCount === 0 && stagedCount === 0 && (
          <div style={{ fontSize: '12px', opacity: 0.5, padding: '8px 0', textAlign: 'center' }}>
            没有未提交的更改
          </div>
        )}
        {status?.unstaged.map(change => (
          <div
            key={`unstaged:${change.path}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', fontSize: '12px', cursor: 'pointer', borderRadius: '3px' }}
            className="dsh-wb-scm-item"
            onClick={() => { void openDiff(change) }}
            data-scm-unstaged-file={change.path}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>{basenameOf(change.path)}</span>
              <span style={{ fontSize: '10px', opacity: 0.5 }}>{change.path}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: statusColor(change.status), fontWeight: 'bold', fontSize: '11px' }}>
                {change.status}
              </span>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title="放弃更改"
                aria-label="放弃更改"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDiscard(change.path)
                }}
              >
                <IconDiscard size={13} />
              </button>
              <button
                type="button"
                className="dsh-wb-actionicon"
                title="暂存更改"
                aria-label="暂存更改"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleStage(change.path)
                }}
              >
                <IconAdd size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
