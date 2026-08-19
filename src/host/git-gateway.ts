/**
 * Host git gateway: runs git operations over the local workspace using system
 * git, served at `POST /api/code-workbench/git`.
 */

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { GIT_ROUTE_PATH } from '../shared/git-contract.ts'
import type {
  GitFileChange, GitFileStatusCode, GitOp, GitResponse, GitValue,
} from '../shared/git-contract.ts'

/** Read small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Narrow request body. */
function parseOp(body: unknown): GitOp {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  const op = candidate.op
  if (typeof candidate.root !== 'string' || candidate.root.length === 0) {
    throw new Error('git op requires a non-empty string root')
  }
  const root = candidate.root
  if (op === 'status') return { op: 'status', root }
  if (op === 'stage' || op === 'unstage' || op === 'discard') {
    if (!Array.isArray(candidate.paths) || candidate.paths.some(p => typeof p !== 'string')) {
      throw new Error(`${op} requires string paths array`)
    }
    return { op, root, paths: candidate.paths as string[] }
  }
  if (op === 'commit') {
    if (typeof candidate.message !== 'string' || candidate.message.trim().length === 0) {
      throw new Error('commit requires a non-empty string message')
    }
    return { op: 'commit', root, message: candidate.message }
  }
  if (op === 'diff') {
    if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
      throw new Error('diff requires a non-empty string path')
    }
    return {
      op: 'diff',
      root,
      path: candidate.path,
      ...(typeof candidate.staged === 'boolean' ? { staged: candidate.staged } : {}),
    }
  }
  throw new Error(`unknown git op "${String(op)}"`)
}

/** Respond JSON. */
function json(res: ServerResponse, status: number, payload: GitResponse): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Safely run git in cwd. */
async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      },
      (error, stdout, stderr) => {
        if (error) reject(error)
        else resolve({ stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

/** Parse porcelain v1 branch line (## branch...tracking or ## HEAD (no branch)). */
function parseBranchLine(header: string): { branch?: string; tracking?: string } {
  const line = header.replace(/^##\s*/u, '').trim()
  if (line.startsWith('No commits yet on ') || line.startsWith('Initial commit on ')) {
    return { branch: line.replace(/^(?:No commits yet on|Initial commit on)\s*/u, '') }
  }
  if (line.includes('HEAD (no branch)') || line.startsWith('(no branch)')) {
    return { branch: 'HEAD' }
  }
  const [branchPart, trackingPart] = line.split('...')
  const tracking = trackingPart?.split(' ')[0]
  return {
    ...(branchPart !== undefined && branchPart !== '' ? { branch: branchPart } : {}),
    ...(tracking !== undefined && tracking !== '' ? { tracking } : {}),
  }
}

/** Parse status lines. */
export function parsePorcelainStatus(output: string): {
  branch?: string
  tracking?: string
  staged: GitFileChange[]
  unstaged: GitFileChange[]
} {
  const lines = output.split(/\r?\n/u).filter(line => line.length > 0)
  if (lines.length === 0) return { staged: [], unstaged: [] }
  let branch: string | undefined
  let tracking: string | undefined
  const staged: GitFileChange[] = []
  const unstaged: GitFileChange[] = []

  let startIndex = 0
  if (lines[0]?.startsWith('##')) {
    const branchInfo = parseBranchLine(lines[0])
    branch = branchInfo.branch
    tracking = branchInfo.tracking
    startIndex = 1
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]!
    if (line.length < 4) continue
    const x = line[0] as GitFileStatusCode
    const y = line[1] as GitFileStatusCode
    let rawPath = line.slice(3).trim()
    let oldPath: string | undefined
    if (rawPath.includes(' -> ')) {
      const parts = rawPath.split(' -> ')
      oldPath = parts[0]?.replace(/^"|"$/gu, '')
      rawPath = parts[1]?.replace(/^"|"$/gu, '') ?? rawPath
    } else {
      rawPath = rawPath.replace(/^"|"$/gu, '')
    }

    if (x === '?' && y === '?') {
      unstaged.push({ path: rawPath, status: '?', staged: false })
      continue
    }

    if (x !== ' ' && x !== '?') {
      staged.push({
        path: rawPath,
        status: x,
        staged: true,
        ...(oldPath !== undefined ? { oldPath } : {}),
      })
    }

    if (y !== ' ' && y !== '?') {
      unstaged.push({
        path: rawPath,
        status: y,
        staged: false,
        ...(oldPath !== undefined ? { oldPath } : {}),
      })
    }
  }

  return {
    ...(branch !== undefined ? { branch } : {}),
    ...(tracking !== undefined ? { tracking } : {}),
    staged,
    unstaged,
  }
}

/** Dispatch one operation. */
async function dispatch(ctx: Context, op: GitOp): Promise<GitValue> {
  const { root } = op
  if (op.op === 'status') {
    try {
      const { stdout } = await runGit(root, ['status', '--porcelain=v1', '-b', '-u'])
      const parsed = parsePorcelainStatus(stdout)
      return {
        kind: 'status',
        isRepo: true,
        ...(parsed.branch !== undefined ? { branch: parsed.branch } : {}),
        ...(parsed.tracking !== undefined ? { tracking: parsed.tracking } : {}),
        staged: parsed.staged,
        unstaged: parsed.unstaged,
      }
    } catch {
      return {
        kind: 'status',
        isRepo: false,
        staged: [],
        unstaged: [],
      }
    }
  }

  if (op.op === 'stage') {
    const paths = op.paths.length === 0 ? ['.'] : op.paths
    await runGit(root, ['add', '-A', '--', ...paths])
    return { kind: 'stage' }
  }

  if (op.op === 'unstage') {
    const paths = op.paths.length === 0 ? ['.'] : op.paths
    try {
      await runGit(root, ['restore', '--staged', '--', ...paths])
    } catch {
      await runGit(root, ['reset', 'HEAD', '--', ...paths])
    }
    return { kind: 'unstage' }
  }

  if (op.op === 'discard') {
    for (const p of op.paths) {
      try {
        await runGit(root, ['restore', '--', p])
      } catch {
        try {
          await runGit(root, ['checkout', '--', p])
        } catch {
          // Untracked fallback
          await runGit(root, ['clean', '-f', '--', p])
        }
      }
    }
    return { kind: 'discard' }
  }

  if (op.op === 'commit') {
    const { stdout } = await runGit(root, ['commit', '-m', op.message])
    const hashMatch = /\[(?:\w+\s+)?([0-9a-f]{7,40})\]/iu.exec(stdout)
    const hash = hashMatch?.[1]
    return { kind: 'commit', ...(hash !== undefined ? { hash } : {}) }
  }

  if (op.op === 'diff') {
    const { path, staged } = op
    let original = ''
    let modified = ''
    if (staged === true) {
      try {
        const { stdout: headOut } = await runGit(root, ['show', `HEAD:${path}`])
        original = headOut
      } catch {
        original = ''
      }
      try {
        const { stdout: indexOut } = await runGit(root, ['show', `:${path}`])
        modified = indexOut
      } catch {
        modified = ''
      }
    } else {
      try {
        const { stdout: indexOut } = await runGit(root, ['show', `:${path}`])
        original = indexOut
      } catch {
        try {
          const { stdout: headOut } = await runGit(root, ['show', `HEAD:${path}`])
          original = headOut
        } catch {
          original = ''
        }
      }
      try {
        const fullPath = `${root.replace(/[/\\]+$/u, '')}/${path}`
        modified = await readFile(fullPath, 'utf8')
      } catch {
        modified = ''
      }
    }
    return { kind: 'diff', original, modified }
  }

  throw new Error('unhandled git op')
}

/** Install the git gateway route. */
export function installGitGateway(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: GIT_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const body = await readJsonBody(req)
        const op = parseOp(body)
        const value = await dispatch(ctx, op)
        json(res, 200, { ok: true, value })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        json(res, 400, { ok: false, code: 'GIT_ERROR', message })
      }
    },
  })
}
