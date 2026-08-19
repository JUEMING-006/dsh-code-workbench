/**
 * fs-ops gateway tests: structural mutations (mkdir/rename/remove) run the
 * workspace-root containment check, the policy waterfall, and the Node
 * primitives, then record fs/observed; escapes and policy denials fail 403
 * without touching the filesystem.
 */
import { posix } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { FsError, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { FileSystem, FsTarget } from '@deepseek-ai/dsh-fs'
import type { FsOpsOp, FsOpsResponse } from '../shared/fs-contract.ts'
import { installFsOpsGateway } from './fs-ops-gateway.ts'
import { WORKBENCH_ACTOR } from './fs-gateway.ts'

vi.mock('node:fs/promises', () => {
  const mkdir = vi.fn(async () => {})
  const rename = vi.fn(async () => {})
  const rm = vi.fn(async () => {})
  // The native ESM module needs the default export on the mock.
  return { default: { mkdir, rename, rm }, mkdir, rename, rm }
})
// eslint-disable-next-line import/first -- the mock must register before the module under test resolves it.
import { mkdir, rename, rm } from 'node:fs/promises'

/** Backend double: canonicalizes like the real backend (path normalization),
 * confines to /w, and reports directory stat for /w only. */
function fakeFs() {
  const root: FsTarget = { targetKey: FsTargetKey('/w'), displayPath: '/w' }
  const resolve = vi.fn(async (path: string): Promise<FsTarget> => {
    const displayPath = posix.normalize(path)
    return { targetKey: FsTargetKey(displayPath), displayPath }
  })
  const stat = vi.fn(async (target: FsTarget) => (
    target.displayPath === '/w'
      ? { version: FsVersion('d1'), type: 'directory' as const }
      : { version: FsVersion('v1'), type: 'file' as const }
  ))
  const contains = (parent: FsTarget, child: FsTarget): boolean =>
    child.displayPath === parent.displayPath || child.displayPath.startsWith(`${parent.displayPath}/`)
  const processPath = (target: FsTarget): string => `/mnt${target.displayPath}`
  const fs = { resolve, stat, contains, processPath } as unknown as FileSystem
  return { fs, root, resolve, stat, processPath }
}

/** Context double: records fs/* emissions and arms the policy waterfall. */
function fakeCtx(waterfallThrows = false, waterfallResult: unknown = undefined) {
  const emit = vi.fn()
  const waterfall = vi.fn(async () => {
    if (waterfallThrows) throw new FsError('policy denies the mutation', 'FS_SANDBOX_DENIED')
    return waterfallResult
  })
  return { emit, waterfall } as unknown as Context
}

/** Web-server double capturing the registered route. */
function fakeWebServer() {
  const routes: WebRoute[] = []
  return {
    routes,
    webServer: { register: (route: WebRoute) => { routes.push(route); return () => {} } } as never,
  }
}

/** Drive one request through the captured route handler. */
async function callRoute(route: WebRoute, op: FsOpsOp, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(op))]) as IncomingMessage
  req.method = method
  const response = { status: 0, body: '' }
  const res = {
    writeHead: (status: number) => { response.status = status },
    end: (body?: string) => { response.body = body ?? '' },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return { ...response, json: response.body.length > 0 ? JSON.parse(response.body) as FsOpsResponse : undefined }
}

function install(fs: FileSystem, ctx: Context) {
  const { webServer, routes } = fakeWebServer()
  installFsOpsGateway({ ...ctx, fs, webServer } as unknown as Context)
  return routes[0]!
}

// The node module mocks live across tests in this file; fresh call state per test.
beforeEach(() => { vi.clearAllMocks() })

describe('fs-ops gateway', () => {
  it('mkdirs through the policy gate and records the observation', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'mkdir', root: '/w', path: '/w/sub/new' })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({ ok: true, value: { kind: 'mkdir', path: '/w/sub/new' } })
    expect(ctx.waterfall).toHaveBeenCalledWith('fs/write-intent', expect.objectContaining({ displayPath: '/w/sub/new' }), WORKBENCH_ACTOR, expect.any(Function))
    expect(mkdir).toHaveBeenCalledWith('/mnt/w/sub/new')
    expect(ctx.emit).toHaveBeenCalledWith('fs/observed', expect.anything(), { kind: 'present', version: 'v1' }, WORKBENCH_ACTOR)
  })

  it('renames both ends in-root and records present + absent', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'rename', root: '/w', path: '/w/a.txt', newPath: '/w/b.txt' })
    expect(result.json).toEqual({ ok: true, value: { kind: 'rename', path: '/w/a.txt', newPath: '/w/b.txt' } })
    expect(rename).toHaveBeenCalledWith('/mnt/w/a.txt', '/mnt/w/b.txt')
    expect(ctx.emit).toHaveBeenCalledWith('fs/observed', expect.objectContaining({ displayPath: '/w/b.txt' }), { kind: 'present', version: 'v1' }, WORKBENCH_ACTOR)
    expect(ctx.emit).toHaveBeenCalledWith('fs/observed', expect.objectContaining({ displayPath: '/w/a.txt' }), { kind: 'absent' }, WORKBENCH_ACTOR)
  })

  it('removes recursively and records the absence', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'remove', root: '/w', path: '/w/sub' })
    expect(result.json).toEqual({ ok: true, value: { kind: 'remove', path: '/w/sub' } })
    expect(rm).toHaveBeenCalledWith('/mnt/w/sub', { recursive: true })
    expect(ctx.emit).toHaveBeenCalledWith('fs/observed', expect.anything(), { kind: 'absent' }, WORKBENCH_ACTOR)
  })

  it('rejects a .. escape with 403 without touching the filesystem', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'mkdir', root: '/w', path: '/w/../outside' })
    expect(result.status).toBe(403)
    expect(result.json).toMatchObject({ ok: false, code: 'FS_OUTSIDE_ROOT' })
    expect(ctx.waterfall).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()
  })

  it('rejects an absolute path outside the root with 403', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'remove', root: '/w', path: '/etc/passwd' })
    expect(result.status).toBe(403)
    expect(result.json).toMatchObject({ ok: false, code: 'FS_OUTSIDE_ROOT' })
    expect(rm).not.toHaveBeenCalled()
  })

  it('passes a policy refusal through as 403 with the policy code', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx(true)
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'mkdir', root: '/w', path: '/w/sub' })
    expect(result.status).toBe(403)
    expect(result.json).toMatchObject({ ok: false, code: 'FS_SANDBOX_DENIED' })
    expect(mkdir).not.toHaveBeenCalled()
  })

  it('fails a non-directory root', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const route = install(fs, ctx)
    const result = await callRoute(route, { op: 'mkdir', root: '/w/a.txt', path: '/w/a.txt/x' })
    expect(result.status).toBe(500)
    expect(result.json).toMatchObject({ ok: false, code: 'GATEWAY_ERROR' })
  })

  it('rejects non-POST with 405 and malformed bodies with 400', async () => {
    const { fs } = fakeFs()
    const route = install(fs, fakeCtx())
    const get = await callRoute(route, { op: 'mkdir', root: '/w', path: '/w/x' }, 'GET')
    expect(get.status).toBe(405)
    const bad = await callRoute(route, { op: 'explode' } as never)
    expect(bad.status).toBe(400)
    expect(bad.json).toMatchObject({ ok: false, code: 'BAD_REQUEST' })
  })
})
