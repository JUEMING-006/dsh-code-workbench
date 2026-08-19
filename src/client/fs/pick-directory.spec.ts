/**
 * Native directory picker RPC client tests.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { pickNativeDirectory } from './pick-directory.ts'

describe('pickNativeDirectory', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('resolves the picked directory path on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'server-response',
        rpcId: 'test-1',
        result: { ok: true, value: { path: '/chosen/project' } },
      }),
    } as unknown as Response)

    const result = await pickNativeDirectory()
    expect(result).toBe('/chosen/project')
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/host.pickDirectory', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }))
  })

  it('resolves null when user cancelled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'server-response',
        rpcId: 'test-2',
        result: { ok: true, value: { path: null } },
      }),
    } as unknown as Response)

    const result = await pickNativeDirectory()
    expect(result).toBeNull()
  })

  it('rejects on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response)

    await expect(pickNativeDirectory()).rejects.toThrow(/HTTP 500/)
  })

  it('rejects on RPC error result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'server-response',
        rpcId: 'test-3',
        result: { ok: false, error: { message: 'dialog spawn failed' } },
      }),
    } as unknown as Response)

    await expect(pickNativeDirectory()).rejects.toThrow(/dialog spawn failed/)
  })
})
