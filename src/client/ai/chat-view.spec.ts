/**
 * Chat row projection tests: node → row mapping for the AI panel.
 */
import { describe, expect, it } from 'vitest'
import type { ChatNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { extractReasoningAndText, nodeRow, textOfBlocks } from './chat-view.ts'

describe('textOfBlocks', () => {
  it('joins text and reasoning blocks', () => {
    const text = textOfBlocks([
      { kind: 'text', text: 'hello' },
      { kind: 'reasoning', text: 'hmm' },
    ])
    expect(text).toBe('hello\nhmm')
  })

  it('summarizes images in assistant blocks', () => {
    const text = textOfBlocks([
      { kind: 'text', text: 'here is an image:' },
      { kind: 'image', attachment: {} as never },
    ])
    expect(text).toContain('here is an image:')
    expect(text).toContain('[image]')
  })
})

describe('extractReasoningAndText', () => {
  it('splits reasoning block from assistant text', () => {
    const { reasoning, text } = extractReasoningAndText([
      { kind: 'reasoning', text: 'Let me think about this step by step.' },
      { kind: 'text', text: 'Here is the final answer.' },
    ])
    expect(reasoning).toBe('Let me think about this step by step.')
    expect(text).toBe('Here is the final answer.')
  })

  it('parses raw <think> tags from text when present', () => {
    const { reasoning, text } = extractReasoningAndText([
      { kind: 'text', text: '<think>Inner model thought</think>Actual output' },
    ])
    expect(reasoning).toBe('Inner model thought')
    expect(text).toBe('Actual output')
  })
})

describe('nodeRow', () => {
  it('projects a user message to its text', () => {
    const row = nodeRow({
      kind: 'user',
      data: {
        kind: 'user',
        seq: 1,
        time: 0,
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'user' },
      },
    } as unknown as ChatNode)
    expect(row).toMatchObject({ kind: 'user', text: 'hi' })
  })

  it('projects an assistant step with its running state and reasoning', () => {
    const row = nodeRow({
      kind: 'assistant-step',
      data: {
        status: 'running',
        turn: 1,
        step: 2,
        blocks: [
          { kind: 'reasoning', text: 'thinking deeply' },
          { kind: 'text', text: 'working' },
        ],
        time: 0,
      },
    } as unknown as ChatNode)
    expect(row).toMatchObject({
      kind: 'assistant',
      text: 'working',
      reasoning: 'thinking deeply',
      running: true,
    })
  })

  it('projects a tool call to structured tool fields', () => {
    const row = nodeRow({
      kind: 'tool-call',
      data: {
        root: {
          callId: 'c1',
          name: 'bash',
          argsRaw: '{"command":"ls"}',
          status: 'success',
          result: 'file1.txt',
          turn: 1,
          step: 1,
          time: 0,
          callView: null,
          subCalls: [],
        },
      },
    } as unknown as ChatNode)
    expect(row).toMatchObject({
      kind: 'tool',
      text: 'bash({"command":"ls"})',
      toolName: 'bash',
      toolArgsRaw: '{"command":"ls"}',
      toolResult: 'file1.txt',
      toolStatus: 'success',
    })
  })

  it('projects a command row', () => {
    const row = nodeRow({
      kind: 'command',
      data: { seq: 5, time: 0, commandId: 'x', name: 'compact', args: '', outcome: { kind: 'success', text: 'done' } },
    } as unknown as ChatNode)
    expect(row).toMatchObject({ kind: 'command', text: '/compact' })
  })

  it('falls back to a system row for unknown kinds', () => {
    const row = nodeRow({ kind: 'unknown', seq: 9, time: 0, type: 'x', data: null } as unknown as ChatNode)
    expect(row).toMatchObject({ kind: 'system', text: '' })
  })
})
