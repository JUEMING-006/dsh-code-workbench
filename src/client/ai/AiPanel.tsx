/**
 * The native AI assistant panel: the workbench's full-capability chat with
 * its host session, upgraded with Qoder-inspired modern UX.
 *
 * Session list + switching, mode tabs (Chat/Agent/Plan), DeepSeek-R1 reasoning
 * collapsible flow, rich Markdown and syntax-highlighted code blocks,
 * structured tool call accordions, slash commands, send/cancel, the pending queue,
 * and smart context attachment (active file and editor selection).
 *
 * It is also the workbench's only interaction outlet: in code mode the
 * harness chat is shadowed away, so this panel renders the pending host
 * interactions from the session snapshot — approvals and questions — and
 * answers them directly.
 */

import { Component, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ErrorInfo, MouseEvent, ReactNode } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  PendingInteraction, RunningToolCall, SessionListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatNode, ToolChatData } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { useWorkbench } from '../workbench/editor-context.ts'
import type { EditorSelection } from '../workbench/editor-context.ts'
import {
  IconAdd, IconClose, IconWarning, IconSparkle, IconPlay, IconStop,
  IconClearAll, IconCommentDiscussion, IconFileCode,
} from '../theme/codicons.tsx'
import { nodeRow } from './chat-view.ts'
import { QuestionCard } from './QuestionCard.tsx'
import { DiffCard } from './DiffCard.tsx'
import { diffProposalOf } from './diff-view.ts'
import { ContextMenu } from '../platform/ContextMenu.tsx'
import { contextMenuEntries } from '../platform/commands.ts'
import { ReasoningBlock } from './ReasoningBlock.tsx'
import { MarkdownView } from './MarkdownView.tsx'
import { ToolAccordion } from './ToolAccordion.tsx'
import { ContextBar } from './ContextBar.tsx'
import type { ChatRow } from './chat-view.ts'
import type { DiffProposal } from './diff-view.ts'

/** Defensive ErrorBoundary for the AI Assistant panel. */
export class AiErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AiPanel render error:', error, info)
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="dsh-wb-placeholder" style={{ flexDirection: 'column', gap: '8px', padding: '16px' }}>
          <div className="dsh-wb-error">AI Assistant Error</div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>{this.state.error.message}</div>
          <button
            type="button"
            className="dsh-wb-button"
            style={{ marginTop: '8px', padding: '4px 12px', fontSize: '12px' }}
            onClick={() => { this.setState({ error: undefined }) }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/** Composed props the sidebar entry delivers (root scope standard kit). */
export interface AiPanelProps {
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly currentCwd?: string | undefined
}

export type AiMode = 'chat' | 'agent' | 'plan'

/** One rendered message row in Qoder style. */
function MessageRowView({ row }: { row: ChatRow }) {
  if (row.kind === 'user') {
    return (
      <div className="dsh-wb-ai-bubble-user" data-chat-row="user">
        <div className="dsh-wb-ai-bubble-header">
          <span className="dsh-wb-ai-bubble-avatar">You</span>
        </div>
        <div className="dsh-wb-ai-bubble-text">{row.text}</div>
      </div>
    )
  }

  if (row.kind === 'assistant') {
    return (
      <div className="dsh-wb-ai-bubble-assistant" data-chat-row="assistant">
        <div className="dsh-wb-ai-bubble-header">
          <span className="dsh-wb-ai-bubble-avatar dsh-wb-ai-avatar-sparkle">
            <IconSparkle size={13} />
            <span>DeepSeek</span>
          </span>
        </div>
        {row.reasoning && (
          <ReasoningBlock text={row.reasoning} running={row.running} />
        )}
        {row.text ? (
          <MarkdownView content={row.text} />
        ) : row.running ? (
          <div className="dsh-wb-ai-streaming-indicator">
            <span className="dsh-wb-ai-think-pulse" />
            <span>Generating response...</span>
          </div>
        ) : null}
      </div>
    )
  }

  if (row.kind === 'tool' && row.toolName) {
    return (
      <ToolAccordion
        name={row.toolName}
        argsRaw={row.toolArgsRaw ?? ''}
        result={row.toolResult}
        status={row.toolStatus}
      />
    )
  }

  if (row.kind === 'command') {
    return (
      <div className="dsh-wb-ai-command-row" data-chat-row="command">
        <span className="dsh-wb-ai-command-prefix">/</span>
        <span className="dsh-wb-ai-command-text">{row.text}</span>
      </div>
    )
  }

  return (
    <div className="dsh-wb-chat-row" data-chat-kind={row.kind}>
      <span className="dsh-wb-chat-role">{row.kind}</span>
      <span className="dsh-wb-chat-text">{row.text}</span>
    </div>
  )
}

/** The shell command from an approval's paired running call. */
function commandOf(calls: readonly RunningToolCall[], callId: string | undefined): string | undefined {
  if (callId === undefined) return undefined
  const call = calls.find(candidate => candidate.callId === callId)
  if (call === undefined) return undefined
  try {
    const args = JSON.parse(call.argsRaw) as Record<string, unknown>
    return typeof args.command === 'string' ? args.command : undefined
  } catch {
    return undefined
  }
}

/** The approval card. */
function ApprovalCard({ pending, command }: {
  pending: Extract<PendingInteraction, { kind: 'approval' }>
  command: string | undefined
}) {
  const [answered, setAnswered] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const answer = (outcome: 'allowed-once' | 'rejected'): void => {
    setAnswered(true)
    setError(undefined)
    void pending.respond({
      ok: true,
      value: {
        sessionId: pending.sessionId,
        approvalId: pending.payload.approvalId,
        outcome,
      },
    }).catch((respondError: unknown) => {
      setAnswered(false)
      setError(respondError instanceof Error ? respondError.message : String(respondError))
    })
  }
  return (
    <div className="dsh-wb-approval" data-approval-key={pending.key}>
      <div className="dsh-wb-approval-strip">
        <IconWarning size={13} />
        Waiting for approval
      </div>
      <div className="dsh-wb-approval-body">
        <div className="dsh-wb-approval-tool">{pending.payload.reason ?? `${pending.payload.toolName} needs approval`}</div>
        {command !== undefined && <div className="dsh-wb-approval-command">{command}</div>}
        {error !== undefined && <div className="dsh-wb-error" data-approval-error>{error}</div>}
      </div>
      <div className="dsh-wb-approval-actions">
        <button
          type="button"
          className="dsh-wb-button-secondary"
          disabled={answered}
          onClick={() => { answer('rejected') }}
          data-approval-reject
        >
          Reject
        </button>
        <button
          type="button"
          className="dsh-wb-button"
          disabled={answered}
          onClick={() => { answer('allowed-once') }}
          data-approval-allow
        >
          Allow Once
        </button>
      </div>
    </div>
  )
}

/** No-session store stand-ins. */
const EMPTY_SNAPSHOT = undefined
function emptySnapshot(): undefined {
  return EMPTY_SNAPSHOT
}
function emptySubscribe(): () => void {
  return () => {}
}

/** One message entry: a flat row or an applyable diff card. */
type ChatEntry = { key: string; kind: 'row'; row: ChatRow } | { key: string; kind: 'diff'; proposal: DiffProposal }

/** The AI assistant panel body. */
export function AiPanel({ useSessions, currentCwd }: AiPanelProps) {
  const services = useWorkbench()
  const listState = useSessions(state => state)
  const currentId = listState.current
  const session = currentId !== undefined ? services.sessions.binding(currentId)?.session : undefined

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (session === undefined) return () => {}
      return session.subscribe(onStoreChange)
    },
    [session],
  )

  const getSnapshot = useCallback(() => {
    if (session === undefined) return undefined
    return session.getSnapshot()
  }, [session])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [aiMode, setAiMode] = useState<AiMode>('agent')
  const [attached, setAttached] = useState<EditorSelection | undefined>()
  const [includeActiveFile, setIncludeActiveFile] = useState(true)
  const [menu, setMenu] = useState<{ x: number; y: number } | undefined>()
  const currentSelection = services.selectionGet?.()

  // Get active file path from active editor group
  const editorSnapshot = services.editor?.getSnapshot()
  const activeGroup = editorSnapshot?.groups.find(g => g.id === editorSnapshot.activeGroupId)
  const activePath = activeGroup?.activePath

  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)

  // Mentions list
  const openTabsList = editorSnapshot?.groups.flatMap(g => g.tabs.map(t => t.path)) ?? []
  const uniqueTabs = Array.from(new Set(openTabsList))

  const mentionItems = useMemo(() => {
    const items: Array<{ id: string; label: string; kind: string; insertText: string }> = [
      { id: 'terminal', label: '@Terminal', kind: 'terminal', insertText: '@Terminal ' },
      { id: 'problems', label: '@Problems', kind: 'problems', insertText: '@Problems ' },
      { id: 'folder', label: '@Workspace', kind: 'folder', insertText: '@Workspace ' },
    ]
    for (const tabPath of uniqueTabs) {
      const base = tabPath.split(/[/\\]/u).pop() ?? tabPath
      items.push({
        id: `file-${tabPath}`,
        label: `@${base}`,
        kind: 'file',
        insertText: `@${base} `,
      })
    }
    if (!mentionQuery) return items
    const q = mentionQuery.toLowerCase()
    return items.filter(i => i.label.toLowerCase().includes(q))
  }, [uniqueTabs, mentionQuery])

  const handleDraftChange = (text: string) => {
    setDraft(text)
    const match = /(?:^|\s)@([a-zA-Z0-9_./\\-]*)$/u.exec(text)
    if (match) {
      setMentionOpen(true)
      setMentionQuery(match[1] ?? '')
      setMentionIndex(0)
    } else {
      setMentionOpen(false)
    }
  }

  const handleInsertMention = (item: { insertText: string }) => {
    setDraft(prev => {
      const match = /(?:^|\s)@([a-zA-Z0-9_./\\-]*)$/u.exec(prev)
      if (match) {
        const prefix = prev.slice(0, match.index + (match[0].startsWith('@') ? 0 : 1))
        return prefix + item.insertText
      }
      return prev + item.insertText
    })
    setMentionOpen(false)
  }

  // Listen for Fix with AI events from terminal or problems panel
  useEffect(() => {
    const handleFixError = (e: Event) => {
      const customEvent = e as CustomEvent<{ errorText: string; cwd?: string }>
      const errorText = customEvent.detail?.errorText
      if (!errorText) return
      setAiMode('agent')
      const promptText = `Terminal output reported the following error:\n\`\`\`\n${errorText}\n\`\`\`\nPlease analyze this error, explain what caused it, and fix the corresponding code.`
      if (session !== undefined) {
        const parts: Parameters<typeof session.prompt>[0] = []
        if (currentCwd) parts.push({ type: 'text', text: `[Workspace: ${currentCwd}]` })
        if (activePath) parts.push({ type: 'text', text: `[Active File: ${activePath}]` })
        parts.push({ type: 'text', text: promptText })
        void session.prompt(parts, 'queue')
      } else {
        setDraft(promptText)
      }
    }
    window.addEventListener('dsh:ai-fix-error', handleFixError)
    return () => { window.removeEventListener('dsh:ai-fix-error', handleFixError) }
  }, [session, currentCwd, activePath])

  const entries = useMemo((): ChatEntry[] => {
    if (snapshot === undefined) return []
    const result: ChatEntry[] = []
    for (const key of snapshot.chat.order) {
      const node = snapshot.chat.nodes.get(key)
      if (node === undefined) continue
      if (node.kind === 'system') continue
      if (node.kind === 'tool-call') {
        const proposal = diffProposalOf((node.data as ToolChatData | undefined)?.root)
        if (proposal !== undefined) {
          result.push({ key: `diff-${proposal.callId}`, kind: 'diff', proposal })
          continue
        }
      }
      const row = nodeRow(node as ChatNode)
      if (row.kind === 'system' && !row.text) continue
      result.push({ key: `row-${key}`, kind: 'row', row })
    }
    return result
  }, [snapshot])

  const approval = snapshot?.pending.find(
    (item): item is Extract<PendingInteraction, { kind: 'approval' }> => item.kind === 'approval',
  )
  const question = snapshot?.pending.find(item => item.kind === 'question')

  const send = async (): Promise<void> => {
    if (session === undefined || draft.trim() === '') return
    let line = draft
    const selection = attached
    setDraft('')
    setAttached(undefined)
    setError(undefined)

    // Mode-specific prompt adjustment
    if (aiMode === 'plan' && !line.startsWith('/plan') && !line.startsWith('/')) {
      line = `/plan ${line}`
    }

    if (line.startsWith('/')) {
      const result = await session.command(line)
      if (!result.ok) setError(result.error.message)
      return
    }

    const parts: Parameters<typeof session.prompt>[0] = []

    // Always inject workspace root info so the model is grounded to the project
    if (currentCwd) {
      parts.push({
        type: 'text',
        text: `[Workspace: ${currentCwd}]`,
      })
    }

    // Attach active file info if requested and selection is not already attached
    if (includeActiveFile && activePath && selection === undefined) {
      parts.push({
        type: 'text',
        text: `[Active File: ${activePath}]`,
      })
    }

    if (selection !== undefined) {
      parts.push({
        type: 'text',
        text: `Selection from ${selection.path} (line ${selection.line}, column ${selection.col}):\n\`\`\`\n${selection.text}\n\`\`\``,
      })
    }

    // Inspect draft for @Terminal or @Problems mentions
    if (line.includes('@Terminal')) {
      line = line.replace(/@Terminal/gu, '')
      const lastOutput = (document.querySelector('.dsh-wb-terminalbody') as HTMLElement | null)?.innerText ?? ''
      if (lastOutput.trim().length > 0) {
        parts.push({
          type: 'text',
          text: `[Terminal Output:\n\`\`\`\n${lastOutput.slice(-2000)}\n\`\`\`]`,
        })
      }
    }
    if (line.includes('@Problems')) {
      line = line.replace(/@Problems/gu, '')
      parts.push({
        type: 'text',
        text: `[Active Problems / Diagnostics attached]`,
      })
    }

    parts.push({ type: 'text', text: line })
    const result = await session.prompt(parts, 'queue')
    if (!result.ok) setError(result.error.message)
  }

  const cancel = async (): Promise<void> => {
    if (session === undefined) return
    const result = await session.cancel()
    if (!result.ok) setError(result.error.message)
  }

  // Filter session history by current workspace directory if present
  const normalizedCwd = currentCwd ? currentCwd.replace(/[/\\]+/gu, '/').toLowerCase() : undefined
  const workspaceIds = listState.ids.filter(id => {
    if (!normalizedCwd) return true
    const sessionCwd = listState.byId[id]?.cwd
    if (!sessionCwd) return true
    return sessionCwd.replace(/[/\\]+/gu, '/').toLowerCase() === normalizedCwd
  })
  const sessionsList = workspaceIds.map(id => ({
    id,
    title: listState.byId[id]?.displayTitle ?? id,
  }))

  return (
    <div
      className="dsh-wb-chat"
      data-ai-panel
      onContextMenu={(event: MouseEvent) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {/* Top Header Bar */}
      <div className="dsh-wb-ai-header">
        <div className="dsh-wb-chat-toolbar">
          <select
            className="dsh-wb-chat-select"
            value={currentId ?? ''}
            onChange={(event) => {
              if (event.target.value !== '') services.sessions.open(event.target.value as never)
            }}
            data-session-picker
          >
            <option value="" disabled>Select session</option>
            {sessionsList.map(item => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <button
            type="button"
            className="dsh-wb-actionicon"
            title="New Session"
            aria-label="New Session"
            onClick={() => { services.workspaces.startSession() }}
            data-session-new
          >
            <IconAdd />
          </button>
        </div>

        {/* Qoder-style Mode Switcher Tabs */}
        <div className="dsh-wb-ai-mode-tabs" data-mode-tabs>
          <button
            type="button"
            className={`dsh-wb-ai-mode-tab${aiMode === 'chat' ? ' dsh-wb-ai-mode-active' : ''}`}
            onClick={() => { setAiMode('chat') }}
            title="Chat: Ask questions & explain code"
          >
            <IconCommentDiscussion size={13} />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={`dsh-wb-ai-mode-tab${aiMode === 'agent' ? ' dsh-wb-ai-mode-active' : ''}`}
            onClick={() => { setAiMode('agent') }}
            title="Agent: Autonomous coding & tool execution"
          >
            <IconSparkle size={13} />
            <span>Agent</span>
          </button>
          <button
            type="button"
            className={`dsh-wb-ai-mode-tab${aiMode === 'plan' ? ' dsh-wb-ai-mode-active' : ''}`}
            onClick={() => { setAiMode('plan') }}
            title="Plan: Multi-step architecture & planning"
          >
            <IconFileCode size={13} />
            <span>Plan</span>
          </button>
        </div>
      </div>

      {session === undefined ? (
        <div className="dsh-wb-placeholder">Select or create a session to chat with DeepSeek AI</div>
      ) : (
        <>
          {/* Message Stream */}
          <div className="dsh-wb-chat-scroll" data-chat-scroll>
            {entries.map(entry => entry.kind === 'row'
              ? <MessageRowView key={entry.key} row={entry.row} />
              : <DiffCard key={entry.key} proposal={entry.proposal} />)}

            {snapshot?.queue.map(item => (
              <div key={item.id} className="dsh-wb-chat-row dsh-wb-chat-pending" data-chat-pending>
                <span className="dsh-wb-chat-role">Queue</span>
                <span className="dsh-wb-chat-text">{item.preview}</span>
              </div>
            ))}

            {snapshot?.running === true && entries.length === 0 && (
              <div className="dsh-wb-ai-streaming-indicator">
                <span className="dsh-wb-ai-think-pulse" />
                <span>DeepSeek is thinking…</span>
              </div>
            )}
          </div>

          {/* Pending Interactions */}
          {approval !== undefined && (
            <ApprovalCard
              pending={approval}
              command={commandOf(snapshot?.runningCalls ?? [], approval.payload.callId)}
            />
          )}
          {question !== undefined && (
            <QuestionCard key={question.key} pending={question} />
          )}

          {/* Bottom Sticky Composer */}
          <div className="dsh-wb-chat-composer" style={{ position: 'relative' }}>
            {/* Mention Dropdown */}
            {mentionOpen && mentionItems.length > 0 && (
              <div className="dsh-wb-ai-mention-menu" data-mention-dropdown>
                <div className="dsh-wb-ai-mention-header">
                  ATTACH CONTEXT (@)
                </div>
                {mentionItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`dsh-wb-ai-mention-item${idx === mentionIndex ? ' dsh-wb-ai-mention-active' : ''}`}
                    onClick={() => { handleInsertMention(item) }}
                    data-mention-item={item.id}
                  >
                    <span>{item.kind === 'terminal' ? '💻' : item.kind === 'problems' ? '⚠️' : item.kind === 'folder' ? '📁' : '📄'}</span>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Context Pills Bar */}
            <ContextBar
              activePath={activePath}
              attachedSelection={attached}
              onRemoveSelection={() => { setAttached(undefined) }}
              includeActiveFile={includeActiveFile}
              onToggleActiveFile={() => { setIncludeActiveFile(v => !v) }}
            />

            <textarea
              className="dsh-wb-chat-input"
              value={draft}
              placeholder={
                aiMode === 'plan'
                  ? 'Describe a task to plan architecture and steps (or type / or @)...'
                  : aiMode === 'chat'
                    ? 'Ask anything about this project (or type / or @)...'
                    : 'Ask DeepSeek to code, edit files, or run commands (type @ to attach)...'
              }
              rows={2}
              onChange={(event) => { handleDraftChange(event.target.value) }}
              onKeyDown={(event) => {
                if (mentionOpen && mentionItems.length > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setMentionIndex(i => (i + 1) % mentionItems.length)
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setMentionIndex(i => (i - 1 + mentionItems.length) % mentionItems.length)
                    return
                  }
                  if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault()
                    const chosen = mentionItems[mentionIndex] ?? mentionItems[0]
                    if (chosen) handleInsertMention(chosen)
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setMentionOpen(false)
                    return
                  }
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              data-chat-input
            />

            <div className="dsh-wb-chat-composerrow">
              <button
                type="button"
                className="dsh-wb-button-secondary"
                disabled={currentSelection === undefined || attached !== undefined}
                onClick={() => { setAttached(currentSelection) }}
                title="Attach editor text selection"
                data-chat-attach-selection
              >
                <IconAdd size={12} />
                <span>Selection</span>
              </button>

              <div style={{ flex: 1 }} />

              {snapshot?.running === true ? (
                <button
                  type="button"
                  className="dsh-wb-button-secondary dsh-wb-ai-stop-btn"
                  onClick={() => { void cancel() }}
                  data-chat-stop
                >
                  <IconStop size={13} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="dsh-wb-button dsh-wb-ai-send-btn"
                  onClick={() => { void send() }}
                  disabled={draft.trim() === ''}
                  data-chat-send
                >
                  <IconPlay size={13} />
                  <span>Send</span>
                </button>
              )}
            </div>
            {error !== undefined && <div className="dsh-wb-error" data-chat-error>{error}</div>}
          </div>
        </>
      )}

      {menu !== undefined && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={contextMenuEntries('chat/context')}
          onRun={(commandId) => { services.runCommand?.(commandId) }}
          onClose={() => { setMenu(undefined) }}
        />
      )}
    </div>
  )
}
