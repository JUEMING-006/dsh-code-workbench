/**
 * Terminal gateway tests: spawn/write/kill/stream routes against a real
 * (short-lived) shell child, plus the xterm stylesheet route and the
 * request guards.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { installTerminalGateway, XTERM_CSS_PATH } from './terminal-gateway.ts'
import { TERMINAL_ROUTE_PATH, TERMINAL_STREAM_PATH } from '../shared/terminal-contract.ts'

/** Capture the registered routes from a fake webServer. */
function captureRoutes() {
  const routes: WebRoute[] = []
  const ctx = {
    webServer: { register: (route: WebRoute) => { routes.push(route); return () => {} } },
  } as never
  const dispose = installTerminalGateway(ctx as never)
  return { routes, dispose }
}

/** Drive one POST request and capture status/body. */
async function post(route: WebRoute, body: unknown) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage
  req.method = 'POST'
  const response = { status: 0, body: '' }
  const res = {
    writeHead: (status: number) => { response.status = status },
    end: (payload?: string) => { response.body = payload ?? '' },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return { ...response, json: response.body.length > 0 ? JSON.parse(response.body) as Record<string, unknown> : undefined }
}

/** Drive one GET request. */
async function get(route: WebRoute, url: string) {
  const req = new Readable() as unknown as IncomingMessage
  req.method = 'GET'
  req.url = url
  const response = { status: 0, body: '' }
  const res = {
    writeHead: (status: number) => { response.status = status },
    end: (payload?: string | Uint8Array) => {
      response.body = typeof payload === 'string' ? payload : Buffer.from(payload ?? new Uint8Array(0)).toString('utf8')
    },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return response
}

const routeOf = (routes: WebRoute[], path: string): WebRoute => routes.find(r => r.path === path)!

describe('terminal gateway', () => {
  it('spawns, writes to, and kills a session', async () => {
    const { routes, dispose } = captureRoutes()
    try {
      const control = routeOf(routes, TERMINAL_ROUTE_PATH)
      const spawned = await post(control, { op: 'spawn' })
      expect(spawned.status).toBe(200)
      const id = (spawned.json!.value as { id: string }).id
      expect(id).toMatch(/^wb-\d+$/u)
      const written = await post(control, { op: 'write', id, data: 'echo hi\r\n' })
      expect(written.json).toMatchObject({ ok: true })
      const killed = await post(control, { op: 'kill', id })
      expect(killed.json).toMatchObject({ ok: true })
      const after = await post(control, { op: 'write', id, data: 'x' })
      expect(after.status).toBe(404)
    } finally {
      dispose()
    }
  })

  it('404s stream requests for unknown sessions', async () => {
    const { routes, dispose } = captureRoutes()
    try {
      const stream = routeOf(routes, TERMINAL_STREAM_PATH)
      const response = await get(stream, `${TERMINAL_STREAM_PATH}?id=nope`)
      expect(response.status).toBe(404)
    } finally {
      dispose()
    }
  })

  it('serves the xterm stylesheet', async () => {
    const { routes, dispose } = captureRoutes()
    try {
      const css = routeOf(routes, XTERM_CSS_PATH)
      const response = await get(css, XTERM_CSS_PATH)
      expect(response.status).toBe(200)
      expect(response.body).toContain('.xterm')
    } finally {
      dispose()
    }
  })

  it('rejects non-POST control requests with 405', async () => {
    const { routes, dispose } = captureRoutes()
    try {
      const control = routeOf(routes, TERMINAL_ROUTE_PATH)
      const response = await get(control, TERMINAL_ROUTE_PATH)
      expect(response.status).toBe(405)
    } finally {
      dispose()
    }
  })

  it('rejects malformed operations with 400', async () => {
    const { routes, dispose } = captureRoutes()
    try {
      const control = routeOf(routes, TERMINAL_ROUTE_PATH)
      const response = await post(control, { op: 'explode' })
      expect(response.status).toBe(400)
    } finally {
      dispose()
    }
  })
})
