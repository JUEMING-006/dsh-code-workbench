/**
 * Chat row projection: turns conversation nodes into flat text rows the AI
 * panel renders. Pure functions — the panel owns React, this module owns the
 * mapping (and its tests).
 */

import type { AssistantBlock, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: brings the ChatNodeDataMap kind→payload mapping (and therefore
// the per-kind `data` narrowing) into this program; erased at build time.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AssistantChatData, ChatNode, ToolChatData } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Narrow command-node shape (the host's CommandNode contract slice). */
interface CommandRowData {
  seq: number
  name: string | null
  args: string | null
  outcome: { kind: 'success' | 'error' } | null
}

/** Row roles the panel styles. */
export type ChatRowKind = 'user' | 'assistant' | 'tool' | 'command' | 'system'

/** One rendered chat row. */
export interface ChatRow {
  /** Stable React key (node identity). */
  readonly key: string
  readonly kind: ChatRowKind
  readonly text: string
  /** DeepSeek reasoning / thinking process content. */
  readonly reasoning?: string | undefined
  /** Assistant rows carry their streaming state. */
  readonly running?: boolean | undefined
  /** Structured tool call details if kind === 'tool'. */
  readonly toolName?: string | undefined
  readonly toolArgsRaw?: string | undefined
  readonly toolResult?: string | undefined
  readonly toolStatus?: ('running' | 'success' | 'error') | undefined
}

/** Extract reasoning block vs answer text from assistant blocks. */
export function extractReasoningAndText(blocks: readonly AssistantBlock[]): { reasoning: string; text: string } {
  let reasoning = ''
  const textParts: string[] = []

  for (const block of blocks) {
    if (block.kind === 'reasoning') {
      reasoning += (reasoning.length > 0 ? '\n' : '') + block.text
    } else if (block.kind === 'text') {
      textParts.push(block.text)
    }
    // Tool calls are handled as separate tool-call nodes by DSH, not embedded in text
  }

  // Also check if text itself contains <think>...</think> tags (raw format from some endpoints)
  let rawText = textParts.join('\n')
  const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/u.exec(rawText)
  if (thinkMatch) {
    if (!reasoning) reasoning = thinkMatch[1]!.trim()
    rawText = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/u, '').trim()
  }

  return { reasoning, text: rawText }
}

/** Join text-bearing content blocks. */
function textOfContent(content: readonly { type: string; text?: string }[]): string {
  return content
    .filter(block => block.type === 'text' && block.text !== undefined)
    .map(block => (block as { text: string }).text)
    .join('\n')
}

/** Join text-bearing assistant blocks. */
export function textOfBlocks(blocks: readonly AssistantBlock[]): string {
  return blocks.map((block) => {
    switch (block.kind) {
      case 'text':
      case 'reasoning':
        return block.text
      case 'image':
        return '[image]'
      default:
        return ''
    }
  }).filter(Boolean).join('\n')
}

/** Project one conversation node to a flat row. */
export function nodeRow(node: ChatNode): ChatRow {
  if (!node || typeof node !== 'object') {
    return { key: 'node-unknown', kind: 'system', text: '' }
  }
  switch (node.kind) {
    case 'user': {
      const data = node.data as unknown as UserMessageNode | undefined
      const content = data && typeof data === 'object' && 'content' in data && Array.isArray(data.content) ? data.content : []
      const seq = data && typeof data === 'object' && 'seq' in data ? data.seq : '0'
      const rawText = textOfContent(content)
      const cleanText = rawText
        .replace(/^\[Workspace:\s*[^\]]+\]\s*/u, '')
        .replace(/^\[Active File:\s*[^\]]+\]\s*/u, '')
        .trim()
      return { key: `user-${seq}`, kind: 'user', text: cleanText || rawText }
    }
    case 'assistant-step': {
      const data = node.data as AssistantChatData | undefined
      const blocks = data && typeof data === 'object' && 'blocks' in data && Array.isArray(data.blocks) ? data.blocks : []
      const { reasoning, text } = extractReasoningAndText(blocks)
      const turn = data && typeof data === 'object' && 'turn' in data ? data.turn : 0
      const step = data && typeof data === 'object' && 'step' in data ? data.step : 0
      const isRunning = data && typeof data === 'object' && 'status' in data && data.status === 'running'
      return {
        key: `assistant-${turn}-${step}`,
        kind: 'assistant',
        text,
        reasoning: reasoning || undefined,
        running: isRunning,
      }
    }
    case 'tool-call': {
      const data = node.data as ToolChatData | undefined
      const root = data && typeof data === 'object' && 'root' in data ? data.root : undefined
      let name = 'tool'
      let args = ''
      let status: 'running' | 'success' | 'error' = 'running'
      let result: string | undefined
      let id = `call-${seqOf(node)}`

      if (root && typeof root === 'object') {
        if ('callId' in root && root.callId) id = String(root.callId)
        if ('kind' in root && root.kind === 'tool-result') {
          const res = root as unknown as {
            call?: { name: string; argsRaw: string }
            name?: string
            argsRaw?: string
            isError?: boolean
            content?: Array<{ type?: string; text?: string } | string>
            error?: { message?: string } | string
          }
          name = res.call?.name ?? res.name ?? 'tool'
          args = res.call?.argsRaw ?? res.argsRaw ?? ''
          status = res.isError ? 'error' : 'success'
          if (Array.isArray(res.content) && res.content.length > 0) {
            result = res.content.map(c => typeof c === 'string' ? c : (c.text ?? JSON.stringify(c))).join('\n')
          } else if (res.error) {
            result = typeof res.error === 'object' ? (res.error.message ?? JSON.stringify(res.error)) : String(res.error)
          }
        } else {
          const run = root as unknown as { name?: string; argsRaw?: string; status?: 'running' | 'success' | 'error'; result?: string }
          name = run.name ?? 'tool'
          args = run.argsRaw ?? ''
          status = run.status ?? 'running'
          result = run.result
        }
      }

      return {
        key: `tool-${id}`,
        kind: 'tool',
        text: `${name}(${args.slice(0, 200)})`,
        toolName: name,
        toolArgsRaw: args,
        toolResult: result,
        toolStatus: status,
      }
    }
    case 'command': {
      const data = node.data as unknown as CommandRowData | undefined
      const seq = data && typeof data === 'object' && 'seq' in data ? data.seq : '0'
      const name = data && typeof data === 'object' && 'name' in data ? String(data.name ?? '') : ''
      const args = data && typeof data === 'object' && 'args' in data ? String(data.args ?? '') : ''
      return {
        key: `command-${seq}`,
        kind: 'command',
        text: `/${name} ${args}`.trim(),
        running: data && typeof data === 'object' && 'outcome' in data ? data.outcome === null : false,
      }
    }
    default:
      return { key: `node-${seqOf(node)}`, kind: 'system', text: '' }
  }
}

function seqOf(node: unknown): string {
  if (node && typeof node === 'object' && 'seq' in node) {
    return String((node as { seq: unknown }).seq)
  }
  return '0'
}
