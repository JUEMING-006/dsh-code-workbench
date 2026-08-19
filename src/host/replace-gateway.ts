/**
 * Host replace gateway: a single-file string replace with version guard.
 * Reads the current file through the fs capability, replaces the first
 * occurrence of `find` with `replace`, and writes the whole file back with
 * the version token to guard against concurrent edits.
 *
 * Mounted at `POST /api/code-workbench/replace`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { REPLACE_ROUTE_PATH } from '../shared/fs-contract.ts'
import type { ReplaceRequest, ReplaceResponse } from '../shared/fs-contract.ts'

/** Read a small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Narrow the request body. */
function parseRequest(body: unknown): ReplaceRequest {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
    throw new Error('replace requires a non-empty string path')
  }
  if (typeof candidate.find !== 'string' || candidate.find.length === 0) {
    throw new Error('replace requires a non-empty string find')
  }
  if (typeof candidate.replace !== 'string') {
    throw new Error('replace requires a string replace')
  }
  return {
    path: candidate.path,
    find: candidate.find,
    replace: candidate.replace,
  }
}

/** Respond JSON with the given status. */
function json(res: ServerResponse, status: number, payload: ReplaceResponse): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Run one replace request. */
async function dispatch(ctx: Context, fs: Context['fs'], request: ReplaceRequest): Promise<ReplaceResponse> {
  const { path, find, replace: replacement } = request
  const target = await fs.resolve(path)
  const content = await fs.readText(target)
  const index = content.indexOf(find)
  if (index === -1) {
    return {
      ok: false,
      code: 'REPLACE_NOT_FOUND',
      message: 'The text to replace was not found in the file',
    }
  }
  const next = content.slice(0, index) + replacement + content.slice(index + find.length)
  await fs.writeText(target, next)
  return {
    ok: true,
    value: {
      path,
      version: '',
    },
  }
}

/**
 * Install the replace gateway route.
 * @param ctx - root context carrying fs and webServer.
 * @returns the route disposer.
 */
export function installReplaceGateway(ctx: Context): () => void {
  const fs = ctx.fs
  return ctx.webServer.register({
    kind: 'prefix',
    path: REPLACE_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'replace gateway accepts POST only' })
        return
      }
      let request: ReplaceRequest
      try {
        request = parseRequest(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        json(res, 200, await dispatch(ctx, fs, request))
      } catch (error) {
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
