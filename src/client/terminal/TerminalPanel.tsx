/**
 * Terminal panel: the workbench bottom-panel occupant.
 * Supports multiple terminal tabs, relaying input over the gateway,
 * rendering SSE output streams, and managing multiple process instances.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { useWorkbench } from '../workbench/editor-context.ts'
import {
  IconAdd, IconChevronDown, IconChevronUp, IconClose, IconRefresh, IconSparkle,
} from '../theme/codicons.tsx'
import { useT } from '../i18n/I18nProvider.tsx'
import { FONT_MONO, TERMINAL_DARK_THEME, TERMINAL_LIGHT_THEME } from '../theme/tokens.ts'

export interface TerminalPanelProps {
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly currentCwd?: string | undefined
}

const XTERM_CSS_URL = '/xterm/xterm.css'

interface TerminalTabState {
  readonly id: string
  readonly sessionId: string
  readonly name: string
  readonly term: Terminal
  readonly fit: FitAddon
  readonly container: HTMLDivElement
  exited: boolean
  outputBuffer: string
  hasError: boolean
  lastErrorText?: string
}

export function TerminalPanel({ useSessions, currentCwd: propCwd }: TerminalPanelProps) {
  const services = useWorkbench()
  const { t } = useT()
  const terminal = services.terminal
  const panelMaximized = services.useLayout?.(state => state.panelMaximized) ?? false
  const sessionCwd = useSessions(state => state.current !== undefined ? state.byId[state.current]?.cwd : undefined)
  const currentCwd = propCwd ?? sessionCwd
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [tabs, setTabs] = useState<TerminalTabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const nextTabIndex = useRef(1)
  const tabsRef = useRef<TerminalTabState[]>([])
  tabsRef.current = tabs

  useEffect(() => {
    if (document.querySelector('link[data-xterm-css]') === null) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = XTERM_CSS_URL
      link.dataset.xtermCss = 'true'
      document.head.appendChild(link)
    }
  }, [])

  const spawningPromiseRef = useRef<Promise<TerminalTabState | undefined> | null>(null)

  const spawnNewTerminal = useCallback(async (name?: string): Promise<TerminalTabState | undefined> => {
    if (terminal === undefined || hostRef.current === null) return undefined
    if (spawningPromiseRef.current !== null) {
      return spawningPromiseRef.current
    }

    const spawnTask = async (): Promise<TerminalTabState | undefined> => {
      setError(undefined)
      try {
        const sessionId = await terminal.spawn(currentCwd)
        const tabId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const tabName = name ?? `bash ${nextTabIndex.current++}`

        const container = document.createElement('div')
        container.className = 'dsh-wb-terminal-tab-host'
        container.style.width = '100%'
        container.style.height = '100%'
        hostRef.current?.appendChild(container)

        const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-workbench-theme') === 'light'
        const theme = isLight ? TERMINAL_LIGHT_THEME : TERMINAL_DARK_THEME
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: FONT_MONO,
          convertEol: true,
          theme,
        })
        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(container)
        fit.fit()
        term.focus()
        container.onclick = () => { term.focus() }

        const newTab: TerminalTabState = {
          id: tabId,
          sessionId,
          name: tabName,
          term,
          fit,
          container,
          exited: false,
          outputBuffer: '',
          hasError: false,
        }

        let disposed = false
        const closeStream = terminal.stream(sessionId, {
          onOutput: (data) => {
            if (!disposed) {
              term.write(data)
              newTab.outputBuffer = (newTab.outputBuffer + data).slice(-8000)
              const hasErr = /(?:Traceback \(most recent call last\):|(?:SyntaxError|TypeError|NameError|ValueError|AttributeError|ImportError|IndexError|KeyError|FileNotFoundError):|Exception:|Error:|panic:|error\[E\d+\]:)/u.test(data) || /(?:Traceback \(most recent call last\):[\s\S]+?(?:\w+Error|Exception):[^\r\n]+)/u.test(newTab.outputBuffer)
              if (hasErr) {
                newTab.hasError = true
                const match = /(?:Traceback \(most recent call last\):[\s\S]+?(?:\w+Error|Exception):[^\r\n]+|(?:SyntaxError|TypeError|NameError|ValueError|AttributeError|ImportError|IndexError|KeyError|FileNotFoundError):[^\r\n]+|Error:[^\r\n]+|panic:[^\r\n]+)/u.exec(newTab.outputBuffer)
                newTab.lastErrorText = match ? match[0].trim() : newTab.outputBuffer.slice(-1500).trim()
                setTabs(prev => [...prev])
              }
            }
          },
          onExit: () => {
            if (!disposed) {
              newTab.exited = true
              setTabs(prev => [...prev])
            }
          },
        })

        let lineBuffer = ''
        const history: string[] = []
        let historyIndex = 0

        const onDataDisposer = term.onData((data) => {
          if (data === '\r') {
            newTab.hasError = false
            setTabs(prev => [...prev])
            term.write('\r\n')
            const cmd = lineBuffer
            lineBuffer = ''
            if (cmd.trim().length > 0) {
              history.push(cmd)
              historyIndex = history.length
            }
            void terminal.write(sessionId, cmd + '\r\n').catch((writeError: unknown) => {
              setError(writeError instanceof Error ? writeError.message : String(writeError))
            })
          } else if (data === '\x7f' || data === '\b') {
            if (lineBuffer.length > 0) {
              lineBuffer = lineBuffer.slice(0, -1)
              term.write('\b \b')
            }
          } else if (data === '\x03') {
            term.write('^C\r\n')
            lineBuffer = ''
            void terminal.write(sessionId, '\x03\r\n').catch(() => {})
          } else if (data === '\x1b[A') {
            if (history.length > 0 && historyIndex > 0) {
              historyIndex -= 1
              const prev = history[historyIndex] ?? ''
              while (lineBuffer.length > 0) {
                term.write('\b \b')
                lineBuffer = lineBuffer.slice(0, -1)
              }
              term.write(prev)
              lineBuffer = prev
            }
          } else if (data === '\x1b[B') {
            if (historyIndex < history.length) {
              historyIndex += 1
              const next = history[historyIndex] ?? ''
              while (lineBuffer.length > 0) {
                term.write('\b \b')
                lineBuffer = lineBuffer.slice(0, -1)
              }
              if (next.length > 0) {
                term.write(next)
                lineBuffer = next
              }
            }
          } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
            lineBuffer += data
            term.write(data)
          } else if (data.length > 1 && !data.startsWith('\x1b')) {
            lineBuffer += data
            term.write(data)
          }
        })

        // Store cleanup on term element
        ;(term as unknown as { _cleanup?: () => void })._cleanup = () => {
          disposed = true
          closeStream()
          onDataDisposer.dispose()
          term.dispose()
          container.remove()
        }

        tabsRef.current = [...tabsRef.current, newTab]
        setTabs(prev => [...prev, newTab])
        setActiveTabId(tabId)
        return newTab
      } catch (spawnError) {
        const message = spawnError instanceof Error ? spawnError.message : String(spawnError)
        setError(message)
        return undefined
      } finally {
        spawningPromiseRef.current = null
      }
    }

    spawningPromiseRef.current = spawnTask()
    return spawningPromiseRef.current
  }, [currentCwd, terminal])

  // Execute a command directly in the active terminal or create one
  const executeCommand = useCallback(async (cmd: string): Promise<void> => {
    if (terminal === undefined) return
    let target = tabsRef.current.find(t => t.id === activeTabId && !t.exited)
    if (target === undefined) {
      target = await spawnNewTerminal()
    }
    if (target === undefined) return
    target.hasError = false
    target.outputBuffer = ''
    setTabs(prev => [...prev])
    const cleanCmd = cmd.trim()
    target.term.write(cleanCmd + '\r\n')
    await terminal.write(target.sessionId, cleanCmd + '\r\n')
  }, [activeTabId, spawnNewTerminal, terminal])

  // Fix error with AI handler
  const handleFixWithAi = useCallback((tab?: TerminalTabState) => {
    const target = tab ?? tabs.find(t => t.id === activeTabId)
    if (!target) return
    const errorSnippet = target.lastErrorText ?? target.outputBuffer.slice(-2000).trim()
    window.dispatchEvent(new CustomEvent('dsh:open-ai-panel'))
    window.dispatchEvent(new CustomEvent('dsh:ai-fix-error', {
      detail: {
        errorText: errorSnippet,
        cwd: currentCwd,
      },
    }))
  }, [tabs, activeTabId, currentCwd])

  // Mount first terminal automatically once host is ready
  useEffect(() => {
    if (tabsRef.current.length === 0 && terminal !== undefined) {
      void spawnNewTerminal()
    }
  }, [spawnNewTerminal, terminal])

  // Listen to run commands triggered by the Run Code button (F5)
  useEffect(() => {
    const handleRunCommand = (e: Event) => {
      const customEvent = e as CustomEvent<{ command: string }>
      const cmd = customEvent.detail?.command
      if (!cmd) return
      void executeCommand(cmd)
    }

    window.addEventListener('dsh:terminal-run-command', handleRunCommand)
    return () => {
      window.removeEventListener('dsh:terminal-run-command', handleRunCommand)
    }
  }, [executeCommand])

  // Stop active terminal process on stop event
  useEffect(() => {
    const handleStop = () => {
      const active = tabsRef.current.find(t => t.id === activeTabId && !t.exited)
      if (active && terminal) {
        active.term.write('^C\r\n')
        void terminal.write(active.sessionId, '\x03\r\n').catch(() => {})
      }
    }
    window.addEventListener('dsh:terminal-stop-active', handleStop)
    return () => { window.removeEventListener('dsh:terminal-stop-active', handleStop) }
  }, [terminal, activeTabId])

  // Fit active terminal on resize or tab change
  useEffect(() => {
    const active = tabs.find(tab => tab.id === activeTabId)
    if (active !== undefined) {
      active.fit.fit()
      active.term.focus()
    }
    const onResize = (): void => {
      active?.fit.fit()
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [activeTabId, tabs])

  // Toggle container visibility based on active tab
  useEffect(() => {
    for (const tab of tabs) {
      tab.container.style.display = tab.id === activeTabId ? 'block' : 'none'
    }
  }, [activeTabId, tabs])

  const closeTab = (tabId: string, e?: React.MouseEvent): void => {
    e?.stopPropagation()
    const target = tabs.find(t => t.id === tabId)
    if (target === undefined) return

    if (terminal !== undefined && !target.exited) {
      void terminal.kill(target.sessionId).catch(() => {})
    }
    ;(target.term as unknown as { _cleanup?: () => void })._cleanup?.()

    const remaining = tabs.filter(t => t.id !== tabId)
    setTabs(remaining)
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1]?.id)
    }
  }

  const restartTab = (tab: TerminalTabState): void => {
    closeTab(tab.id)
    void spawnNewTerminal(tab.name)
  }

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  return (
    <div className="dsh-wb-panel" data-terminal-panel style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header with tabs */}
      <div className="dsh-wb-paneltitle" data-panel-header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
          {/* Tab Strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} data-terminal-tabs>
            {tabs.map(tab => (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  background: tab.id === activeTabId ? 'var(--dsh-wb-chromeHoverBackground)' : 'transparent',
                  opacity: tab.id === activeTabId ? 1 : 0.6,
                }}
                onClick={() => { setActiveTabId(tab.id) }}
                data-terminal-tab={tab.id}
              >
                <span>{tab.name}</span>
                {tab.exited && <span style={{ fontSize: '9px', opacity: 0.7 }}>(exited)</span>}
                {tab.hasError && <span style={{ color: 'var(--dsh-wb-errorForeground)', fontSize: '11px' }}>●</span>}
                <button
                  type="button"
                  className="dsh-wb-actionicon"
                  style={{ padding: 0, width: '14px', height: '14px' }}
                  title="关闭终端"
                  aria-label="关闭终端"
                  onClick={(e) => { closeTab(tab.id, e) }}
                >
                  <IconClose size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="dsh-wb-actionicon"
            title="新建终端"
            aria-label="新建终端"
            onClick={() => { void spawnNewTerminal() }}
            data-terminal-new
          >
            <IconAdd size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Fix with AI Button */}
          {activeTab?.hasError && (
            <button
              type="button"
              className="dsh-wb-fix-ai-btn"
              title="使用 DeepSeek AI 智能分析并修复此终端报错"
              onClick={() => { handleFixWithAi(activeTab) }}
              data-terminal-fix-ai
            >
              <IconSparkle size={13} />
              <span>⚡ Fix with AI</span>
            </button>
          )}

          <button
            type="button"
            className="dsh-wb-actionicon"
            title={panelMaximized ? t('terminal.restorePanel') : t('terminal.maximizePanel')}
            aria-label={panelMaximized ? t('terminal.restorePanel') : t('terminal.maximizePanel')}
            onClick={() => { services.panelActions?.togglePanelMaximize() }}
            data-panel-maximize
          >
            {panelMaximized ? <IconChevronDown /> : <IconChevronUp />}
          </button>
          <button
            type="button"
            className="dsh-wb-actionicon"
            title={t('terminal.closePanel')}
            aria-label={t('terminal.closePanel')}
            onClick={() => { services.panelActions?.togglePanel() }}
            data-panel-close
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* Terminal Hosts Container */}
      <div
        ref={hostRef}
        className="dsh-wb-terminalbody"
        data-terminal-host
        style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '4px', cursor: 'text' }}
        onClick={() => { activeTab?.term.focus() }}
      />

      {/* Exited Notification for active tab */}
      {activeTab?.exited && (
        <div className="dsh-wb-panelnotice" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', fontSize: '12px' }}>
          <span>{t('terminal.sessionExited')}</span>
          <button
            type="button"
            className="dsh-wb-button-secondary"
            onClick={() => { restartTab(activeTab) }}
            data-terminal-restart
          >
            <IconRefresh size={12} />
            <span style={{ marginLeft: '4px' }}>{t('terminal.restart')}</span>
          </button>
        </div>
      )}

      {error !== undefined && <div className="dsh-wb-error" data-terminal-error>{error}</div>}
    </div>
  )
}
