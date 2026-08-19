/**
 * fs gateway tests: the wire behavior (op dispatch, typed failures, method
 * and body guards) and — critically — the policy-chain contract: reads emit
 * fs/observed, writes run through the fs/write-intent waterfall with the
 * workbench actor, and a policy refusal fails the request.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { FsError, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import type { FsGatewayOp, FsGatewayResponse } from '../shared/fs-contract.ts'
import { installFsGateway, WORKBENCH_ACTOR } from './fs-gateway.ts'

/** In-memory filesystem double: one file plus one directory. */
function fakeFs() {
  const file = { key: FsTargetKey('/w/a.txt'), version: FsVersion('v1'), content: 'hello' }
  const dir = { key: FsTargetKey('/w'), version: FsVersion('d1') }
  const stat = vi.fn(async (target: { targetKey: string }) => {
    if (target.targetKey === file.key) return { version: file.version, type: 'file' as const, size: 5 }
    if (target.targetKey === dir.key) return { version: dir.version, type: 'directory' as const }
    return undefined
  })
  const listDir = vi.fn(async () => [
    { name: 'a.txt', type: 'file' as const },
    { name: 'sub', type: 'directory' as const },
  ])
  const readText = vi.fn(async () => file.content)
  const writeText = vi.fn(async () => ({ version: FsVersion('v2'), operation: 'create' as const, before: undefined, after: 'new' }))
  const fs = {
    resolve: vi.fn(async (path: string) => ({
      targetKey: path === '/w' ? dir.key : path === '/w/a.txt' ? file.key : FsTargetKey(path),
      displayPath: path,
    })),
    stat,
    listDir,
    readText,
    writeText,
  } as unknown as FileSystem
  return { fs, file, dir, stat, listDir, readText, writeText }
}

/** Context double: records fs/* emissions and arms the policy waterfall. */
function fakeCtx(waterfallResult: unknown = undefined, waterfallThrows = false) {
  const emit = vi.fn()
  const waterfall = vi.fn(async () => {
    if (waterfallThrows) throw new FsError('policy denies', 'FS_NOT_OBSERVED')
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
async function callRoute(route: WebRoute, op: FsGatewayOp, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(op))]) as IncomingMessage
  req.method = method
  const response = { status: 0, body: '' }
  const res = {
    writeHead: (status: number) => { response.status = status },
    end: (body?: string) => { response.body = body ?? '' },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return { ...response, json: response.body.length > 0 ? JSON.parse(response.body) as FsGatewayResponse : undefined }
}

/** In-memory tree for the recursive walk: dirs keyed by path. */
function treeFs(tree: Record<string, readonly { name: string; type: 'file' | 'directory' }[]>): FileSystem {
  return {
    resolve: vi.fn(async (path: string) => ({ targetKey: FsTargetKey(path), displayPath: path })),
    stat: vi.fn(async (target: { displayPath: string }) => (
      tree[target.displayPath] !== undefined
        ? { version: FsVersion('d'), type: 'directory' as const }
        : { version: FsVersion('f'), type: 'file' as const }
    )),
    listDir: vi.fn(async (target: { displayPath: string }) => tree[target.displayPath] ?? []),
    readText: vi.fn(async () => ''),
    writeText: vi.fn(async () => ({ version: FsVersion('v2'), operation: 'create' as const, before: undefined, after: 'new' })),
  } as unknown as FileSystem
}

describe('fs gateway — listAll', () => {
  it('walks the tree recursively as root-relative file paths', async () => {
    const fs = treeFs({
      '/w': [
        { name: 'a.txt', type: 'file' },
        { name: 'sub', type: 'directory' },
        { name: 'node_modules', type: 'directory' },
        { name: '.git', type: 'directory' },
      ],
      '/w/sub': [
        { name: 'b.md', type: 'file' },
        { name: 'deep', type: 'directory' },
      ],
      '/w/sub/deep': [{ name: 'c.ts', type: 'file' }],
      '/w/node_modules': [{ name: 'hidden.js', type: 'file' }],
      '/w/.git': [{ name: 'config', type: 'file' }],
    })
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'listAll', path: '/w' })
    expect(result.json).toMatchObject({
      ok: true,
      value: {
        kind: 'listAll',
        root: '/w',
        files: expect.arrayContaining(['a.txt', 'sub/b.md', 'sub/deep/c.ts']),
      },
    })
    expect(result.json!.ok).toBe(true)
    const files = (result.json as unknown as { value: { files: string[] } }).value.files
    expect(files.some(file => file.startsWith('node_modules/'))).toBe(false)
    expect(files.some(file => file.startsWith('.git/'))).toBe(false)    // A pure listing observes nothing.
    expect(ctx.emit).not.toHaveBeenCalled()
  })

  it('fails the recursive listing for a non-directory', async () => {
    const fs = treeFs({})
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'listAll', path: '/w/a.txt' })
    expect(result.json).toMatchObject({ ok: false, code: 'FS_NOT_DIRECTORY' })
  })
})

describe('fs gateway', () => {
  it('lists a directory with stable entries', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'listDir', path: '/w' })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({
      ok: true,
      value: {
        kind: 'listDir',
        path: '/w',
        entries: [
          { name: 'a.txt', type: 'file' },
          { name: 'sub', type: 'directory' },
        ],
      },
    })
    expect(ctx.emit).not.toHaveBeenCalled()
  })

  it('fails listing a non-directory with FS_NOT_DIRECTORY', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'listDir', path: '/w/a.txt' })
    expect(result.json).toMatchObject({ ok: false, code: 'FS_NOT_DIRECTORY' })
  })

  it('reads a text file, recording the observed state with the workbench actor', async () => {
    const { fs, file } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'readText', path: '/w/a.txt' })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({
      ok: true,
      value: { kind: 'readText', file: { path: '/w/a.txt', content: 'hello', version: 'v1' } },
    })
    expect(ctx.emit).toHaveBeenCalledWith(
      'fs/observed',
      expect.objectContaining({ targetKey: file.key }),
      { kind: 'present', version: 'v1' },
      WORKBENCH_ACTOR,
    )
  })

  it('fails reading an absent file with FS_NOT_FOUND', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'readText', path: '/w/missing.txt' })
    expect(result.json).toMatchObject({ ok: false, code: 'FS_NOT_FOUND' })
  })

  it('writes without a version as an unconditional write through the policy waterfall', async () => {
    const { fs, file, writeText } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'writeText', path: '/w/a.txt', content: 'new' })
    expect(result.json).toEqual({ ok: true, value: { kind: 'writeText', path: '/w/a.txt', version: 'v2' } })
    expect(ctx.waterfall).toHaveBeenCalledWith('fs/write-intent', expect.anything(), WORKBENCH_ACTOR, expect.any(Function))
    expect(writeText).toHaveBeenCalledWith(
      expect.objectContaining({ targetKey: file.key }),
      'new',
      undefined,
      undefined,
      { mode: 'danger-full-access', workspaceRoot: '/w/a.txt' },
    )
    expect(ctx.emit).toHaveBeenCalledWith('fs/observed', expect.anything(), { kind: 'present', version: 'v2' }, WORKBENCH_ACTOR)
  })

  it('writes with a version as a guarded replaceIfVersion intent', async () => {
    const { fs, writeText } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    await callRoute(routes[0]!, { op: 'writeText', path: '/w/a.txt', content: 'new', version: 'v1' })
    expect(writeText).toHaveBeenCalledWith(
      expect.anything(),
      'new',
      { kind: 'replaceIfVersion', version: 'v1' },
      undefined,
      { mode: 'danger-full-access', workspaceRoot: '/w/a.txt' },
    )
  })

  it('prefers the policy waterfall intent over the client intent', async () => {
    const { fs, writeText } = fakeFs()
    const ctx = fakeCtx({ kind: 'createIfAbsent' })
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    await callRoute(routes[0]!, { op: 'writeText', path: '/w/a.txt', content: 'new', version: 'v1' })
    expect(writeText).toHaveBeenCalledWith(
      expect.anything(),
      'new',
      { kind: 'createIfAbsent' },
      undefined,
      { mode: 'danger-full-access', workspaceRoot: '/w/a.txt' },
    )
  })

  it('fails a write the policy refuses', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx(undefined, true)
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'writeText', path: '/w/a.txt', content: 'new' })
    expect(result.json).toMatchObject({ ok: false, code: 'FS_NOT_OBSERVED' })
  })

  it('rejects non-POST with 405', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const result = await callRoute(routes[0]!, { op: 'listDir', path: '/w' }, 'GET')
    expect(result.status).toBe(405)
    expect(result.json).toMatchObject({ ok: false, code: 'METHOD_NOT_ALLOWED' })
  })

  it('rejects malformed bodies with 400', async () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    const { webServer, routes } = fakeWebServer()
    installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    const req = Readable.from([Buffer.from(JSON.stringify({ op: 'explode' }))]) as IncomingMessage
    req.method = 'POST'
    const response = { status: 0, body: '' }
    const res = {
      writeHead: (status: number) => { response.status = status },
      end: (body?: string) => { response.body = body ?? '' },
    } as unknown as ServerResponse
    await routes[0]!.handler(req, res)
    expect(response.status).toBe(400)
    expect(JSON.parse(response.body)).toMatchObject({ ok: false, code: 'GATEWAY_ERROR' })
  })

  it('returns a disposer that removes the route', () => {
    const { fs } = fakeFs()
    const ctx = fakeCtx()
    let disposed = false
    const webServer = {
      register: () => { return () => { disposed = true } },
    } as never
    const dispose = installFsGateway({ ...ctx, fs, webServer } as unknown as Context)
    dispose()
    expect(disposed).toBe(true)
  })
})
