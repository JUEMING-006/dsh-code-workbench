/**
 * Lightweight, high-fidelity Markdown view for AI assistant responses.
 * Renders paragraphs, headings, bullet lists, inline code, and code blocks.
 */

import React from 'react'
import { CodeBlockView } from './CodeBlockView.tsx'

export interface MarkdownViewProps {
  readonly content: string
}

interface MarkdownBlock {
  type: 'paragraph' | 'code' | 'heading' | 'list'
  content: string
  lang?: string
  level?: number
  items?: string[]
}

function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = raw.split('\n')
  let inCode = false
  let codeLang = ''
  let codeBuffer: string[] = []
  let textBuffer: string[] = []
  let listBuffer: string[] = []

  const flushText = () => {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'paragraph', content: textBuffer.join('\n') })
      textBuffer = []
    }
  }

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', content: '', items: [...listBuffer] })
      listBuffer = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // Code block fence
    if (trimmed.startsWith('```')) {
      if (inCode) {
        // Closing fence
        blocks.push({ type: 'code', content: codeBuffer.join('\n'), lang: codeLang })
        codeBuffer = []
        codeLang = ''
        inCode = false
      } else {
        // Opening fence
        flushText()
        flushList()
        inCode = true
        codeLang = trimmed.slice(3).trim()
      }
      continue
    }

    if (inCode) {
      codeBuffer.push(line)
      continue
    }

    // Heading (# ... ###)
    const headingMatch = /^(#{1,6})\s+(.+)$/u.exec(line)
    if (headingMatch) {
      flushText()
      flushList()
      blocks.push({
        type: 'heading',
        level: headingMatch[1]!.length,
        content: headingMatch[2]!,
      })
      continue
    }

    // Bullet or numbered list item (- / * / 1.)
    const listMatch = /^(\*|-|\d+\.)\s+(.+)$/u.exec(line)
    if (listMatch) {
      flushText()
      listBuffer.push(listMatch[2]!)
      continue
    } else if (listBuffer.length > 0) {
      flushList()
    }

    // Normal line
    if (trimmed === '') {
      flushText()
      flushList()
    } else {
      textBuffer.push(line)
    }
  }

  // Flush remaining
  if (inCode) {
    blocks.push({ type: 'code', content: codeBuffer.join('\n'), lang: codeLang })
  }
  flushText()
  flushList()

  return blocks
}

/** Render inline formatting: **bold**, *italic*, `inline-code`, and URLs */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Split by inline code `...`
  const codeRegex = /`([^`]+)`/gu
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderFormatting(text.slice(lastIndex, match.index), parts.length))
    }
    parts.push(
      <code key={`code-${match.index}`} className="dsh-wb-ai-inline-code">
        {match[1]}
      </code>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(renderFormatting(text.slice(lastIndex), parts.length))
  }

  return parts
}

function renderFormatting(text: string, baseKey: number): React.ReactNode {
  // Simple bold **text** replace
  const boldParts = text.split(/(\*\*[^*]+\*\*)/gu)
  return (
    <span key={`fmt-${baseKey}`}>
      {boldParts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        return part
      })}
    </span>
  )
}

export function MarkdownView({ content }: MarkdownViewProps) {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="dsh-wb-ai-markdown" data-markdown-view>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'code':
            return <CodeBlockView key={index} code={block.content} language={block.lang} />
          case 'heading': {
            const Tag = `h${Math.min(6, Math.max(1, block.level ?? 2))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
            return (
              <Tag key={index} className="dsh-wb-ai-heading">
                {renderInline(block.content)}
              </Tag>
            )
          }
          case 'list':
            return (
              <ul key={index} className="dsh-wb-ai-list">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'paragraph':
          default:
            return (
              <p key={index} className="dsh-wb-ai-paragraph">
                {renderInline(block.content)}
              </p>
            )
        }
      })}
    </div>
  )
}
