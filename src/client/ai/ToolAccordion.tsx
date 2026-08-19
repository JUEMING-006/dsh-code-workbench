/**
 * Qoder-style Tool Call Accordion:
 * Categorizes and displays tools (Bash, File Write/Edit, Search, Web Fetch)
 * with status indicators and collapsible input/output views.
 */

import { useState } from 'react'
import {
  IconChevronDown, IconChevronRight, IconTerminal, IconFileCode,
  IconSearch, IconCheck, IconError, IconSparkle,
} from '../theme/codicons.tsx'

export interface ToolAccordionProps {
  readonly name: string
  readonly argsRaw: string
  readonly result?: string | undefined
  readonly status?: ('running' | 'success' | 'error') | undefined
}

function parseToolSummary(name: string, argsRaw: string): { category: string; summary: string; commandOrPath?: string } {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(argsRaw) as Record<string, unknown>
  } catch {
    // Unparseable args
  }

  const lowName = name.toLowerCase()
  if (lowName.includes('bash') || lowName.includes('pwsh') || lowName.includes('terminal') || lowName.includes('exec') || lowName.includes('command')) {
    const cmd = typeof parsed.command === 'string' ? parsed.command : typeof parsed.cmd === 'string' ? parsed.cmd : argsRaw
    return { category: 'terminal', summary: `Run Command: ${cmd.slice(0, 70)}`, commandOrPath: cmd }
  }
  if (lowName.includes('read') || lowName.includes('write') || lowName.includes('edit') || lowName.includes('create') || lowName.includes('file')) {
    const path = typeof parsed.file_path === 'string' ? parsed.file_path : typeof parsed.filePath === 'string' ? parsed.filePath : typeof parsed.path === 'string' ? parsed.path : ''
    return { category: 'file', summary: `${name}: ${path}`, commandOrPath: path }
  }
  if (lowName.includes('grep') || lowName.includes('glob') || lowName.includes('search') || lowName.includes('find') || lowName.includes('list')) {
    const query = typeof parsed.pattern === 'string' ? parsed.pattern : typeof parsed.query === 'string' ? parsed.query : typeof parsed.path === 'string' ? parsed.path : ''
    return { category: 'search', summary: `${name}: ${query}`, commandOrPath: query }
  }
  return { category: 'generic', summary: `${name}` }
}

export function ToolAccordion({ name, argsRaw, result, status = 'success' }: ToolAccordionProps) {
  const [expanded, setExpanded] = useState(status === 'running')
  const { category, summary, commandOrPath } = parseToolSummary(name, argsRaw)

  const CategoryIcon = () => {
    switch (category) {
      case 'terminal': return <IconTerminal size={14} />
      case 'file': return <IconFileCode size={14} />
      case 'search': return <IconSearch size={14} />
      default: return <IconSparkle size={14} />
    }
  }

  return (
    <div className={`dsh-wb-ai-tool-accordion dsh-wb-ai-tool-${status}`} data-tool-accordion>
      <button
        type="button"
        className="dsh-wb-ai-tool-header"
        onClick={() => { setExpanded(open => !open) }}
        data-tool-toggle
      >
        <span className="dsh-wb-ai-tool-chevron">
          {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        </span>
        <span className="dsh-wb-ai-tool-cat-icon">
          <CategoryIcon />
        </span>
        <span className="dsh-wb-ai-tool-summary" title={summary}>
          {summary}
        </span>
        <span className="dsh-wb-ai-tool-status">
          {status === 'running' && <span className="dsh-wb-ai-think-pulse" />}
          {status === 'success' && <IconCheck size={13} />}
          {status === 'error' && <IconError size={13} />}
        </span>
      </button>
      {expanded && (
        <div className="dsh-wb-ai-tool-body" data-tool-body>
          {commandOrPath && (
            <div className="dsh-wb-ai-tool-param">
              <strong>Target: </strong>
              <code>{commandOrPath}</code>
            </div>
          )}
          <div className="dsh-wb-ai-tool-raw">
            <div className="dsh-wb-ai-tool-sublabel">Arguments</div>
            <pre className="dsh-wb-ai-tool-code">{argsRaw}</pre>
          </div>
          {result && (
            <div className="dsh-wb-ai-tool-raw">
              <div className="dsh-wb-ai-tool-sublabel">Output</div>
              <pre className="dsh-wb-ai-tool-code">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
