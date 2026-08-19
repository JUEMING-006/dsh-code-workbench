/**
 * Search gateway tests: the wire behavior (method guard, body parsing, hits
 * cap, context lines) and the three SPEC-mandated acceptance cases — a hit,
 * a miss, and the 500-hit truncation.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { installSearchGateway } from './search-gateway.ts'

/** Drive one request through the captured route handler. */
async function callRoute(route: WebRoute, body: unknown, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage
  req.method = method
  const response = { status: 0, body: '' }
  const res = {
    writeHead: (status: number) => { response.status = status },
    end: (body?: string) => { response.body = body ?? '' },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return { ...response, json: response.body.length > 0 ? JSON.parse(response.body) : undefined }
}

describe('search gateway — wire', () => {
  it('rejects non-POST with 405', async () => {
    const routes: WebRoute[] = []
    const webServer = { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never
    installSearchGateway({ webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { pattern: 'x', root: '/w' }, 'GET')
    expect(result.status).toBe(405)
    expect(result.json).toMatchObject({ ok: false, code: 'METHOD_NOT_ALLOWED' })
  })

  it('rejects malformed bodies with 400', async () => {
    const routes: WebRoute[] = []
    const webServer = { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never
    installSearchGateway({ webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { pattern: '', root: '/w' })
    expect(result.status).toBe(400)
    expect(result.json).toMatchObject({ ok: false, code: 'BAD_REQUEST' })
  })
})

describe('search gateway — dispatch', () => {
  /** In-memory tree: /w/a.txt has two lines matching 'needle', /w/sub/b.txt has none. */
  function treeFs() {
    const fs = {
      resolve: vi.fn(async (path: string) => path),
      stat: vi.fn(async () => ({ version: 'v1', type: 'file' as const, size: 10 })),
      listDir: vi.fn(async (path: string) => {
        if (path === '/w') return [{ name: 'a.txt', type: 'file' as const }, { name: 'sub', type: 'directory' as const }]
        if (path === '/w/sub') return [{ name: 'b.txt', type: 'file' as const }]
        return []
      }),
      readText: vi.fn(async (path: string) => {
        if (path.endsWith('a.txt')) return 'line one\nneedle here\nmore\nneedle again\nlast'
        if (path.endsWith('b.txt')) return 'no match here\nstill no'
        return ''
      }),
    }
    return fs
  }

  it('returns matches with three context lines on each side', async () => {
    const fs = treeFs()
    const routes: WebRoute[] = []
    const webServer = { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never
    installSearchGateway({ fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { pattern: 'needle', root: '/w' })
    expect(result.status).toBe(200)
    expect(result.json).toMatchObject({
      ok: true,
      value: {
        kind: 'search',
        root: '/w',
        pattern: 'needle',
        truncated: false,
        matches: expect.arrayContaining([
          { path: 'a.txt', line: 2, text: 'needle here', before: ['line one'], after: ['more'] },
          { path: 'a.txt', line: 4, text: 'needle again', before: ['more'], after: ['last'] },
        ]),
      },
    })
  })

  it('returns no matches when nothing hits', async () => {
    const fs = treeFs()
    const routes: WebRoute[] = []
    const webServer = { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never
    installSearchGateway({ fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { pattern: 'nope', root: '/w' })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({
      ok: true,
      value: { kind: 'search', root: '/w', pattern: 'nope', matches: [], truncated: false },
    })
  })

  it('stops at 500 hits and sets truncated', async () => {
    const line = 'x needle x\n'
    const bigContent = Array.from({ length: 600 }, (_, i) => `line ${i} ${i % 2 === 0 ? 'needle' : 'no'}`).join('\n')
    const fs = {
      ...treeFs(),
      readText: vi.fn(async () => bigContent),
    }
    const routes: WebRoute[] = []
    const webServer = { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never
    installSearchGateway({ fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { pattern: 'needle', root: '/w' })
    expect(result.status).toBe(200)
    const matches = result.json!.value.matches
    expect(matches).toHaveLength(500)
    expect(result.json!.value.truncated).toBe(true)
  })
})
