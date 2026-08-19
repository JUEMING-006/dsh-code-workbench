import { describe, expect, it, vi } from 'vitest'
import { createGitClient, GitGatewayError } from './client.ts'

describe('createGitClient', () => {
  it('calls status and parses successful response', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        value: {
          kind: 'status',
          isRepo: true,
          branch: 'main',
          tracking: 'origin/main',
          staged: [{ path: 'a.ts', status: 'M', staged: true }],
          unstaged: [{ path: 'b.ts', status: '?', staged: false }],
        },
      }),
    }))

    const client = createGitClient(fakeFetch as never)
    const result = await client.status('/workspace')

    expect(result.isRepo).toBe(true)
    expect(result.branch).toBe('main')
    expect(result.staged).toHaveLength(1)
    expect(result.unstaged).toHaveLength(1)
  })

  it('handles git error responses', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: false,
        code: 'GIT_ERROR',
        message: 'fatal: not a git repo',
      }),
    }))

    const client = createGitClient(fakeFetch as never)
    await expect(client.status('/workspace')).rejects.toThrow(GitGatewayError)
  })

  it('performs stage, unstage, discard, commit, and diff', async () => {
    const fakeFetch = vi.fn(async (_url: string, init: { body: string }) => {
      const parsed = JSON.parse(init.body) as { op: string }
      if (parsed.op === 'commit') {
        return {
          ok: true,
          json: async () => ({ ok: true, value: { kind: 'commit', hash: 'abc1234' } }),
        }
      }
      if (parsed.op === 'diff') {
        return {
          ok: true,
          json: async () => ({ ok: true, value: { kind: 'diff', original: 'const a = 1;', modified: 'const a = 2;' } }),
        }
      }
      return {
        ok: true,
        json: async () => ({ ok: true, value: { kind: parsed.op } }),
      }
    })

    const client = createGitClient(fakeFetch as never)

    await client.stage('/workspace', ['a.ts'])
    await client.unstage('/workspace', ['a.ts'])
    await client.discard('/workspace', ['a.ts'])
    const commit = await client.commit('/workspace', 'feat: done')
    expect(commit.hash).toBe('abc1234')
    const diff = await client.diff('/workspace', 'a.ts')
    expect(diff.original).toBe('const a = 1;')
    expect(diff.modified).toBe('const a = 2;')
  })
})
