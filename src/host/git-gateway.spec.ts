import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { installGitGateway, parsePorcelainStatus } from './git-gateway.ts'
import type { GitOp, GitResponse } from '../shared/git-contract.ts'

vi.mock('node:child_process', () => {
  const execFile = vi.fn((...args: any[]) => {
    const cb = args[args.length - 1]
    if (typeof cb === 'function') {
      cb(null, '## master...origin/master\n M src/file.ts\n?? new.txt\n', '')
    }
  })
  return { execFile, default: { execFile } }
})
// eslint-disable-next-line import/first
import { execFile } from 'node:child_process'

function fakeWebServer() {
  let route: WebRoute | undefined
  const register = vi.fn((candidate: WebRoute) => {
    route = candidate
    return () => { route = undefined }
  })
  return { register, getRoute: () => route }
}

function postRequest(body: GitOp): IncomingMessage {
  const jsonString = JSON.stringify(body)
  const stream = Readable.from([Buffer.from(jsonString)]) as unknown as IncomingMessage
  stream.method = 'POST'
  stream.url = '/api/code-workbench/git'
  return stream
}

function fakeResponse(): { res: ServerResponse; getPayload: () => GitResponse; getStatus: () => number } {
  let status = 0
  let raw = ''
  const res = {
    writeHead: vi.fn((code: number) => { status = code }),
    end: vi.fn((data?: string) => { if (data !== undefined) raw = data }),
  } as unknown as ServerResponse
  return {
    res,
    getStatus: () => status,
    getPayload: () => JSON.parse(raw) as GitResponse,
  }
}

describe('parsePorcelainStatus', () => {
  it('parses branch and staged/unstaged changes correctly', () => {
    const raw = [
      '## feat/ui...origin/feat/ui [ahead 1]',
      'M  staged-only.ts',
      ' M unstaged-only.ts',
      'MM both.ts',
      'A  added.ts',
      'D  deleted.ts',
      'R  old.ts -> new.ts',
      '?? untracked.ts',
    ].join('\n')

    const result = parsePorcelainStatus(raw)
    expect(result.branch).toBe('feat/ui')
    expect(result.tracking).toBe('origin/feat/ui')
    expect(result.staged).toHaveLength(5)
    expect(result.staged.map(s => s.path)).toEqual([
      'staged-only.ts',
      'both.ts',
      'added.ts',
      'deleted.ts',
      'new.ts',
    ])
    expect(result.unstaged).toHaveLength(3)
    expect(result.unstaged.map(u => u.path)).toEqual([
      'unstaged-only.ts',
      'both.ts',
      'untracked.ts',
    ])
  })

  it('handles empty / clean repo status', () => {
    const raw = '## main\n'
    const result = parsePorcelainStatus(raw)
    expect(result.branch).toBe('main')
    expect(result.staged).toHaveLength(0)
    expect(result.unstaged).toHaveLength(0)
  })
})

describe('git-gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the exact route and dispatches status', async () => {
    const webServer = fakeWebServer()
    const ctx = { webServer } as unknown as Context
    installGitGateway(ctx)

    const route = webServer.getRoute()
    expect(route).toBeDefined()
    expect(route?.kind).toBe('exact')

    const req = postRequest({ op: 'status', root: '/workspace' })
    const { res, getPayload, getStatus } = fakeResponse()

    await route?.handler(req, res)

    expect(getStatus()).toBe(200)
    const payload = getPayload()
    expect(payload.ok).toBe(true)
    if (payload.ok && payload.value.kind === 'status') {
      expect(payload.value.isRepo).toBe(true)
      expect(payload.value.branch).toBe('master')
    }
  })

  it('rejects non-POST requests with 405', async () => {
    const webServer = fakeWebServer()
    const ctx = { webServer } as unknown as Context
    installGitGateway(ctx)

    const req = Readable.from([]) as unknown as IncomingMessage
    req.method = 'GET'
    const { res, getStatus } = fakeResponse()

    await webServer.getRoute()?.handler(req, res)
    expect(getStatus()).toBe(405)
  })

  it('handles stage, unstage, commit, and diff', async () => {
    const webServer = fakeWebServer()
    const ctx = { webServer } as unknown as Context
    installGitGateway(ctx)
    const route = webServer.getRoute()!

    // stage
    const stageReq = postRequest({ op: 'stage', root: '/workspace', paths: ['src/a.ts'] })
    const stageRes = fakeResponse()
    await route.handler(stageReq, stageRes.res)
    expect(stageRes.getStatus()).toBe(200)
    expect(stageRes.getPayload().ok).toBe(true)

    // unstage
    const unstageReq = postRequest({ op: 'unstage', root: '/workspace', paths: ['src/a.ts'] })
    const unstageRes = fakeResponse()
    await route.handler(unstageReq, unstageRes.res)
    expect(unstageRes.getStatus()).toBe(200)

    // commit
    const commitReq = postRequest({ op: 'commit', root: '/workspace', message: 'feat: new' })
    const commitRes = fakeResponse()
    await route.handler(commitReq, commitRes.res)
    expect(commitRes.getStatus()).toBe(200)

    // diff
    const diffReq = postRequest({ op: 'diff', root: '/workspace', path: 'src/a.ts' })
    const diffRes = fakeResponse()
    await route.handler(diffReq, diffRes.res)
    expect(diffRes.getStatus()).toBe(200)
  })
})
