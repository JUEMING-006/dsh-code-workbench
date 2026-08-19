/**
 * fs client tests: request/response codec against a fetch double, plus the
 * typed failure surface (business codes and transport errors).
 */
import { describe, expect, it, vi } from 'vitest'
import type { FsGatewayResponse, SearchResponse } from '../../shared/fs-contract.ts'
import { createFsClient, FsGatewayError, type FetchLike } from './client.ts'

/** Fetch double answering from a canned gateway response. */
function fetchWith(response: FsGatewayResponse): { fetchImpl: FetchLike; sent: () => unknown } {
  const sent: unknown[] = []
  const fetchImpl: FetchLike = async (_url, init) => {
    sent.push(JSON.parse(init.body) as unknown)
    return { ok: true, json: async () => response }
  }
  return { fetchImpl, sent: () => sent[0] }
}

describe('fs client', () => {
  it('lists a directory', async () => {
    const response: FsGatewayResponse = {
      ok: true,
      value: { kind: 'listDir', path: '/w', entries: [{ name: 'a.txt', type: 'file' }] },
    }
    const { fetchImpl, sent } = fetchWith(response)
    const client = createFsClient(fetchImpl)
    const result = await client.listDir('/w')
    expect(result).toEqual({ path: '/w', entries: [{ name: 'a.txt', type: 'file' }] })
    expect(sent()).toEqual({ op: 'listDir', path: '/w' })
  })

  it('reads a text file with its version', async () => {
    const response: FsGatewayResponse = {
      ok: true,
      value: { kind: 'readText', file: { path: '/w/a.txt', content: 'hi', version: 'v1' } },
    }
    const { fetchImpl } = fetchWith(response)
    const file = await createFsClient(fetchImpl).readText('/w/a.txt')
    expect(file).toEqual({ path: '/w/a.txt', content: 'hi', version: 'v1' })
  })

  it('writes unconditionally when no version is supplied', async () => {
    const response: FsGatewayResponse = {
      ok: true,
      value: { kind: 'writeText', path: '/w/a.txt', version: 'v2' },
    }
    const { fetchImpl, sent } = fetchWith(response)
    const result = await createFsClient(fetchImpl).writeText('/w/a.txt', 'new')
    expect(result).toEqual({ path: '/w/a.txt', version: 'v2' })
    expect(sent()).toEqual({ op: 'writeText', path: '/w/a.txt', content: 'new' })
  })

  it('writes with a version guard when one is supplied', async () => {
    const response: FsGatewayResponse = { ok: true, value: { kind: 'writeText', path: '/w/a.txt', version: 'v2' } }
    const { fetchImpl, sent } = fetchWith(response)
    await createFsClient(fetchImpl).writeText('/w/a.txt', 'new', 'v1')
    expect(sent()).toEqual({ op: 'writeText', path: '/w/a.txt', content: 'new', version: 'v1' })
  })

  it('surfaces a typed business failure', async () => {
    const { fetchImpl } = fetchWith({ ok: false, code: 'FS_NOT_FOUND', message: 'missing' })
    await expect(createFsClient(fetchImpl).readText('/w/nope')).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'FS_NOT_FOUND',
    })
  })

  it('surfaces a transport failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down') }) as unknown as FetchLike
    await expect(createFsClient(fetchImpl).listDir('/w')).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'TRANSPORT_ERROR',
    })
  })

  it('rejects a response answering with the wrong op', async () => {
    const response: FsGatewayResponse = { ok: true, value: { kind: 'listDir', path: '/w', entries: [] } }
    const { fetchImpl } = fetchWith(response)
    await expect(createFsClient(fetchImpl).readText('/w/a.txt')).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'BAD_RESPONSE',
    })
  })

  it('exports the typed error class for instanceof checks', () => {
    const error = new FsGatewayError('X', 'msg')
    expect(error).toBeInstanceOf(FsGatewayError)
    expect(error.code).toBe('X')
  })
})

describe('fs client — search', () => {
  it('surfaces a typed business failure', async () => {
    const response: SearchResponse = { ok: false, code: 'FS_NOT_FOUND', message: 'missing' }
    const fetchImpl: FetchLike = async () => ({ ok: true, json: async () => response })
    await expect(createFsClient(fetchImpl).search({ pattern: 'x', root: '/w' })).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'FS_NOT_FOUND',
    })
  })

  it('surfaces a transport failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down') }) as unknown as FetchLike
    await expect(createFsClient(fetchImpl).search({ pattern: 'x', root: '/w' })).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'TRANSPORT_ERROR',
    })
  })

  it('rejects a response answering with the wrong op', async () => {
    const response = { ok: true, value: { kind: 'listDir', path: '/w', entries: [] } } as unknown as SearchResponse
    const fetchImpl: FetchLike = async () => ({ ok: true, json: async () => response })
    await expect(createFsClient(fetchImpl).search({ pattern: 'x', root: '/w' })).rejects.toMatchObject({
      name: 'FsGatewayError',
      code: 'BAD_RESPONSE',
    })
  })

  it('returns parsed matches on success', async () => {
    const response: SearchResponse = {
      ok: true,
      value: {
        kind: 'search',
        root: '/w',
        pattern: 'needle',
        truncated: true,
        matches: [{ path: 'a.txt', line: 2, text: 'needle here', before: ['line one'], after: ['more'] }],
      },
    }
    const sent: unknown[] = []
    const fetchImpl: FetchLike = async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => response } }
    const result = await createFsClient(fetchImpl).search({ pattern: 'needle', root: '/w' })
    expect(result).toEqual({ root: '/w', pattern: 'needle', matches: response.value.matches, truncated: true })
    expect(sent[0]).toEqual({ pattern: 'needle', root: '/w' })
  })
})
