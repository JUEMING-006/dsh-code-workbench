/**
 * DeepSeek Reasoning block: collapsible thought chain component.
 * Renders the model's inner reasoning stream with live duration and smooth toggle.
 */

import { useState } from 'react'
import { IconChevronDown, IconChevronRight, IconSparkle } from '../theme/codicons.tsx'

export interface ReasoningBlockProps {
  readonly text: string
  readonly running?: boolean | undefined
  readonly durationSec?: number | undefined
}

export function ReasoningBlock({ text, running, durationSec }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(running === true)

  if (text.trim() === '' && !running) return null

  const label = running
    ? 'Thinking process...'
    : durationSec !== undefined
      ? `Thought for ${durationSec.toFixed(1)}s`
      : 'Thought process'

  return (
    <div className={`dsh-wb-ai-think-card${running ? ' dsh-wb-ai-think-running' : ''}`} data-think-card>
      <button
        type="button"
        className="dsh-wb-ai-think-header"
        onClick={() => { setExpanded(open => !open) }}
        data-think-toggle
      >
        <span className="dsh-wb-ai-think-icon">
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span className="dsh-wb-ai-think-sparkle"><IconSparkle size={13} /></span>
        <span className="dsh-wb-ai-think-label">{label}</span>
        {running && <span className="dsh-wb-ai-think-pulse" />}
      </button>
      {expanded && (
        <div className="dsh-wb-ai-think-body" data-think-body>
          <div className="dsh-wb-ai-think-text">{text}</div>
        </div>
      )}
    </div>
  )
}
