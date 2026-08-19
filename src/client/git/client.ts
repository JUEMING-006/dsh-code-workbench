/**
 * Browser git client: typed fetch wrapper over the host git gateway.
 */

import { GIT_ROUTE_PATH } from '../../shared/git-contract.ts'
import type {
  GitFileChange, GitOp, GitResponse,
} from '../../shared/git-contract.ts'

export type { GitFileChange } from '../../shared/git-contract.ts'

export class GitGatewayError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GitGatewayError'
  }
}

export type FetchLike = (
  url: string,
  init: { method: string; body: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export interface GitStatusResult {
  readonly isRepo: boolean
  readonly branch?: string | undefined
  readonly tracking?: string | undefined
  readonly staged: readonly GitFileChange[]
  readonly unstaged: readonly GitFileChange[]
}

export interface GitClient {
  status(root: string): Promise<GitStatusResult>
  stage(root: string, paths: readonly string[]): Promise<void>
  unstage(root: string, paths: readonly string[]): Promise<void>
  discard(root: string, paths: readonly string[]): Promise<void>
  commit(root: string, message: string): Promise<{ hash?: string | undefined }>
  diff(root: string, path: string, staged?: boolean): Promise<{ original: string; modified: string }>
}

export function createGitClient(fetch: FetchLike = globalThis.fetch): GitClient {
  const call = async (op: GitOp): Promise<unknown> => {
    let response: { ok: boolean; json(): Promise<unknown> }
    try {
      response = await fetch(GIT_ROUTE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(op),
      })
    } catch (cause) {
      throw new GitGatewayError('TRANSPORT_ERROR', cause instanceof Error ? cause.message : String(cause))
    }

    const payload = (await response.json()) as GitResponse
    if (!payload.ok) throw new GitGatewayError(payload.code, payload.message)
    return payload.value
  }

  return {
    async status(root: string): Promise<GitStatusResult> {
      const res = (await call({ op: 'status', root })) as Extract<GitResponse, { ok: true }>['value']
      if (res.kind !== 'status') throw new GitGatewayError('PROTOCOL_ERROR', 'expected status')
      return {
        isRepo: res.isRepo,
        branch: res.branch,
        tracking: res.tracking,
        staged: res.staged,
        unstaged: res.unstaged,
      }
    },

    async stage(root: string, paths: readonly string[]): Promise<void> {
      await call({ op: 'stage', root, paths })
    },

    async unstage(root: string, paths: readonly string[]): Promise<void> {
      await call({ op: 'unstage', root, paths })
    },

    async discard(root: string, paths: readonly string[]): Promise<void> {
      await call({ op: 'discard', root, paths })
    },

    async commit(root: string, message: string): Promise<{ hash?: string | undefined }> {
      const res = (await call({ op: 'commit', root, message })) as Extract<GitResponse, { ok: true }>['value']
      if (res.kind !== 'commit') throw new GitGatewayError('PROTOCOL_ERROR', 'expected commit')
      return { hash: res.hash }
    },

    async diff(root: string, path: string, staged?: boolean): Promise<{ original: string; modified: string }> {
      const op: GitOp = staged !== undefined ? { op: 'diff', root, path, staged } : { op: 'diff', root, path }
      const res = (await call(op)) as Extract<GitResponse, { ok: true }>['value']
      if (res.kind !== 'diff') throw new GitGatewayError('PROTOCOL_ERROR', 'expected diff')
      return { original: res.original, modified: res.modified }
    },
  }
}
