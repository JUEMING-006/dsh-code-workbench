import { describe, expect, it, vi } from 'vitest'
import {
  parseCopilotRequest,
  parseInlineEditRequest,
  sanitizeCompletionText,
  dispatchCopilotCompletion,
  installCompletionGateway,
} from './completion-gateway.ts'
import { COPILOT_ROUTE_PATH, INLINE_EDIT_ROUTE_PATH } from '../shared/fs-contract.ts'

describe('parseCopilotRequest', () => {
  it('parses valid completion request', () => {
    const parsed = parseCopilotRequest({
      prefix: 'def hello():',
      suffix: 'print("end")',
      language: 'python',
      path: '/app/main.py',
    })
    expect(parsed).toEqual({
      prefix: 'def hello():',
      suffix: 'print("end")',
      language: 'python',
      path: '/app/main.py',
    })
  })

  it('rejects invalid payloads', () => {
    expect(() => parseCopilotRequest(null)).toThrow('JSON object')
    expect(() => parseCopilotRequest({})).toThrow('string prefix')
    expect(() => parseCopilotRequest({ prefix: 123 })).toThrow('string prefix')
  })
})

describe('parseInlineEditRequest', () => {
  it('parses valid inline edit request', () => {
    const parsed = parseInlineEditRequest({
      instruction: 'Refactor loop',
      selectedCode: 'for x in y: pass',
      prefix: 'def run():',
      suffix: 'return',
      language: 'python',
      path: 'main.py',
    })
    expect(parsed).toEqual({
      instruction: 'Refactor loop',
      selectedCode: 'for x in y: pass',
      prefix: 'def run():',
      suffix: 'return',
      language: 'python',
      path: 'main.py',
    })
  })

  it('rejects invalid inline edit payloads', () => {
    expect(() => parseInlineEditRequest(null)).toThrow('must be an object')
    expect(() => parseInlineEditRequest({})).toThrow('instruction must be a non-empty string')
    expect(() => parseInlineEditRequest({ instruction: 'test' })).toThrow('selectedCode must be a string')
  })
})

describe('sanitizeCompletionText', () => {
  it('strips markdown code blocks', () => {
    expect(sanitizeCompletionText('```python\nprint("hi")\n```')).toBe('print("hi")')
    expect(sanitizeCompletionText('```\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('preserves clean single and multi-line code', () => {
    expect(sanitizeCompletionText('    return True')).toBe('    return True')
    expect(sanitizeCompletionText('    x = 10\n    return x')).toBe('    x = 10\n    return x')
  })
})

describe('dispatchCopilotCompletion', () => {
  it('returns empty string when prefix is empty', async () => {
    const res = await dispatchCopilotCompletion({} as never, { prefix: '   ' })
    expect(res).toEqual({ ok: true, completion: '' })
  })
})

describe('installCompletionGateway', () => {
  it('registers route on webServer', () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { webServer: { register } } as never
    const dispose = installCompletionGateway(ctx)
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ path: COPILOT_ROUTE_PATH }))
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ path: INLINE_EDIT_ROUTE_PATH }))
    expect(typeof dispose).toBe('function')
  })
})
