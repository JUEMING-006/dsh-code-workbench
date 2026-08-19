/**
 * monaco static route tests: the traversal fence, method guard, content-type
 * mapping, and 404s. The distribution root is resolved from the installed
 * monaco-editor package, so the route serves real assets.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { installMonacoStatic, MONACO_ROUTE_PATH } from './monaco-static.ts'

/** Capture the registered route from a fake webServer. */
function captureRoute() {
  const routes: WebRoute[] = []
  const ctx = {
    webServer: { register: (route: WebRoute) => { routes.push(route); return () => {} } },
  } as never
  installMonacoStatic(ctx as never)
  return routes[0]!
}

/** Drive one request through the handler and capture status/body/type. */
async function get(route: WebRoute, path: string) {
  const req = new Readable() as unknown as IncomingMessage
  req.method = 'GET'
  req.url = path
  const response: { status: number; body: Uint8Array; type: string } = { status: 0, body: new Uint8Array(0), type: '' }
  const res = {
    writeHead: (status: number, headers?: Record<string, string>) => {
      response.status = status
      response.type = headers?.['content-type'] ?? ''
    },
    end: (body?: string | Uint8Array) => {
      if (body !== undefined) response.body = typeof body === 'string' ? Buffer.from(body) : body
    },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return response
}

describe('monaco static route', () => {
  it('serves the AMD loader from the distribution', async () => {
    const route = captureRoute()
    const response = await get(route, `${MONACO_ROUTE_PATH}/vs/loader.js`)
    expect(response.status).toBe(200)
    expect(response.type).toContain('text/javascript')
    expect(response.body.length).toBeGreaterThan(1000)
  })

  it('serves the editor entry', async () => {
    const route = captureRoute()
    const response = await get(route, `${MONACO_ROUTE_PATH}/vs/editor/editor.main.js`)
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThan(1000)
  })

  it('serves css with the css content type', async () => {
    const route = captureRoute()
    const response = await get(route, `${MONACO_ROUTE_PATH}/vs/editor/editor.main.css`)
    expect(response.status).toBe(200)
    expect(response.type).toContain('text/css')
    expect(response.body.length).toBeGreaterThan(100)
  })

  it('rejects traversal outside the distribution root', async () => {
    const route = captureRoute()
    const response = await get(route, `${MONACO_ROUTE_PATH}/../../package.json`)
    expect(response.status).toBe(404)
  })

  it('404s unknown assets', async () => {
    const route = captureRoute()
    const response = await get(route, `${MONACO_ROUTE_PATH}/vs/nope.js`)
    expect(response.status).toBe(404)
  })
})
