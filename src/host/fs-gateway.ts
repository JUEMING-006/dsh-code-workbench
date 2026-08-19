/**
 * Host fs gateway: exposes the filesystem capability to the workbench browser
 * half over a small JSON HTTP carrier (`/api/code-workbench/fs`).
 *
 * Every mutation rides the same policy chain the model tools ride: a
 * `fs/write-intent` waterfall before `writeText` (the policy plugin produces
 * the guarded intent, the bare default is undefined = unconditional), and an
 * `fs/observed` emission after reads/writes so the observation policy can
 * enforce read-before-edit and version-guarded writes. The actor token is a
 * fixed plugin-owned object, so the workbench's observation state is its own
 * domain, never confused with the model tools'.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge into this program.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import { noteActiveFile } from './active-file.ts'
import type { FileSystem, FsErrorCode } from '@deepseek-ai/dsh-fs'
import { FsError, FsVersion } from '@deepseek-ai/dsh-fs'
import { FS_ROUTE_PATH } from '../shared/fs-contract.ts'
import type { FsGatewayOp, FsGatewayResponse } from '../shared/fs-contract.ts'

/** The opaque actor token identifying workbench-originated fs activity. */
export const WORKBENCH_ACTOR = Object.freeze({ kind: 'code-workbench' })

/**
 * The stable fs error codes the provider contract owns.
 *
 * Code-based (not instanceof-based) deliberately: the plugin ships against
 * published dsh releases while the host may run a different release, so error
 * classes from the two package instances must still be recognized. The code
 * vocabulary is contract-stable.
 */
const FS_ERROR_CODES = new Set<string>([
  'FS_NOT_FOUND',
  'FS_NOT_DIRECTORY',
  'FS_NOT_TEXT',
  'FS_NOT_REGULAR_FILE',
  'FS_TOO_LARGE',
  'FS_PERMISSION_DENIED',
  'FS_SANDBOX_DENIED',
  'FS_IO_ERROR',
  'FS_STALE_VERSION',
  'FS_NOT_OBSERVED',
  'FS_AMBIGUOUS_EDIT',
  'FS_EDIT_NOT_FOUND',
  'FS_ABORTED',
])

/** Narrow an unknown thrown value to a stable fs error code. */
function fsErrorCodeOf(error: unknown): FsErrorCode | undefined {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && FS_ERROR_CODES.has(code) ? code as FsErrorCode : undefined
}

/** Wire response for an error that is not a typed FsError. */
function unexpectedFailure(error: unknown): FsGatewayResponse {
  return {
    ok: false,
    code: 'GATEWAY_ERROR',
    message: error instanceof Error ? error.message : String(error),
  }
}

/** Narrow an unknown JSON body to a gateway operation. */
function parseOp(body: unknown): FsGatewayOp {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  if (candidate.op !== 'listDir' && candidate.op !== 'readText' && candidate.op !== 'writeText' && candidate.op !== 'noteActiveFile' && candidate.op !== 'listAll') {
    throw new Error(`unknown fs gateway op "${String(candidate.op)}"`)
  }
  if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
    throw new Error('fs gateway op requires a non-empty string path')
  }
  if (candidate.op === 'writeText') {
    if (typeof candidate.content !== 'string') throw new Error('writeText requires a string content')
    if (candidate.version !== undefined && typeof candidate.version !== 'string') {
      throw new Error('writeText version must be a string')
    }
  }
  if (candidate.op === 'noteActiveFile' && candidate.sessionId !== undefined && typeof candidate.sessionId !== 'string') {
    throw new Error('noteActiveFile sessionId must be a string')
  }
  return candidate as unknown as FsGatewayOp
}

/** Read and parse a small JSON request body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw.length === 0) return undefined
  return JSON.parse(raw) as unknown
}

/**
 * Directory names the recursive walk never descends into (dependency and VCS
 * internals: huge, never user-targeted in Quick Open).
 */
const WALK_EXCLUDED_DIRS = new Set(['node_modules', '.git'])

/** Ceiling on the recursive listing (the walk stops and returns what it has). */
const WALK_MAX_FILES = 10000

/**
 * Bounded recursive file listing under one root: BFS over listDir, files as
 * root-relative paths, directories minus the excluded names. Listing reads no
 * file contents, so — like listDir — it emits no fs/observed observation.
 */
async function walkFiles(fs: FileSystem, root: { displayPath: string }): Promise<string[]> {
  const files: string[] = []
  const queue: { dirPath: string; prefix: string }[] = [{ dirPath: root.displayPath, prefix: '' }]
  while (queue.length > 0 && files.length < WALK_MAX_FILES) {
    const { dirPath, prefix } = queue.shift()!
    const target = await fs.resolve(dirPath)
    for (const entry of await fs.listDir(target)) {
      if (files.length >= WALK_MAX_FILES) break
      if (entry.type === 'file') files.push(`${prefix}${entry.name}`)
      else if (entry.type === 'directory' && !WALK_EXCLUDED_DIRS.has(entry.name)) {
        queue.push({ dirPath: `${dirPath}/${entry.name}`, prefix: `${prefix}${entry.name}/` })
      }
    }
  }
  return files
}

/** Normalize incoming path string for Windows drive roots and cross-platform safety. */
export function normalizeHostPath(raw: string): string {
  let cleaned = raw.trim()
  if (cleaned.length === 0) return cleaned
  // Strip leading slash before Windows drive if present (e.g. "/D:/..." -> "D:/...")
  cleaned = cleaned.replace(/^\/([a-zA-Z]:)/u, '$1')
  // Ensure drive letter has a trailing backslash when given alone (e.g. "D:" -> "D:\", "D:/" -> "D:\")
  if (/^[a-zA-Z]:[/\\]?$/u.test(cleaned)) {
    return `${cleaned.charAt(0).toUpperCase()}:\\`
  }
  return cleaned
}

/** Run one operation against the policy-armed filesystem. */
async function dispatch(ctx: Context, fs: FileSystem, op: FsGatewayOp): Promise<FsGatewayResponse> {
  switch (op.op) {
    case 'listDir': {
      const target = await fs.resolve(normalizeHostPath(op.path))
      const info = await fs.stat(target)
      if (info === undefined) throw new FsError(`cannot list "${target.displayPath}": not found`, 'FS_NOT_FOUND')
      if (info.type !== 'directory') {
        throw new FsError(`cannot list "${target.displayPath}": not a directory`, 'FS_NOT_DIRECTORY')
      }
      const entries = await fs.listDir(target)
      return {
        ok: true,
        value: {
          kind: 'listDir',
          path: target.displayPath,
          entries: entries.map(entry => ({ name: entry.name, type: entry.type })),
        },
      }
    }
    case 'listAll': {
      const target = await fs.resolve(normalizeHostPath(op.path))
      const info = await fs.stat(target)
      if (info === undefined) throw new FsError(`cannot list "${target.displayPath}": not found`, 'FS_NOT_FOUND')
      if (info.type !== 'directory') {
        throw new FsError(`cannot list "${target.displayPath}": not a directory`, 'FS_NOT_DIRECTORY')
      }
      return { ok: true, value: { kind: 'listAll', root: target.displayPath, files: await walkFiles(fs, target) } }
    }
    case 'readText': {
      const target = await fs.resolve(normalizeHostPath(op.path))
      const info = await fs.stat(target)
      if (info === undefined) throw new FsError(`cannot read "${target.displayPath}": not found`, 'FS_NOT_FOUND')
      if (info.type !== 'file') {
        throw new FsError(`cannot read "${target.displayPath}": not a regular file`, 'FS_NOT_REGULAR_FILE')
      }
      const content = await fs.readText(target)
      // Record the present observation (a no-op when no policy plugin listens).
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, WORKBENCH_ACTOR)
      return {
        ok: true,
        value: {
          kind: 'readText',
          file: { path: target.displayPath, content, version: info.version },
        },
      }
    }
    case 'noteActiveFile': {
      noteActiveFile(ctx, op.path, op.sessionId === undefined ? undefined : op.sessionId as SessionId)
      return { ok: true, value: { kind: 'noteActiveFile' } }
    }
    case 'writeText': {
      const target = await fs.resolve(normalizeHostPath(op.path))
      // The wire carries the version as a plain string; restore the brand the
      // provider contract requires.
      const clientIntent = op.version === undefined
        ? undefined
        : { kind: 'replaceIfVersion' as const, version: FsVersion(op.version) }
      // Single-slot decision: the policy plugin produces the guarded intent;
      // the bare default is undefined (unconditional). No stat — the guard
      // itself is the staleness check.
      const guarded = await ctx.waterfall('fs/write-intent', target, WORKBENCH_ACTOR, () => undefined)
      // Direct user action in the developer workbench operates with full access
      // to the file opened by the user, bypassing agent-only workspace restrictions.
      const outcome = await fs.writeText(target, op.content, guarded ?? clientIntent, undefined, {
        mode: 'danger-full-access',
        workspaceRoot: target.displayPath,
      })
      ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, WORKBENCH_ACTOR)
      return {
        ok: true,
        value: { kind: 'writeText', path: target.displayPath, version: outcome.version },
      }
    }
  }
}

/**
 * Install the fs gateway route on the web server.
 * @param ctx - root context carrying fs and webServer.
 * @returns the route disposer.
 */
export function installFsGateway(ctx: Context): () => void {
  const fs = ctx.fs
  return ctx.webServer.register({
    kind: 'prefix',
    path: FS_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'fs gateway accepts POST only' }))
        return
      }
      let op: FsGatewayOp
      try {
        op = parseOp(await readJsonBody(req))
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify(unexpectedFailure(error)))
        return
      }
      let response: FsGatewayResponse
      try {
        response = await dispatch(ctx, fs, op)
      } catch (error) {
        const code = fsErrorCodeOf(error)
        response = code !== undefined
          ? { ok: false, code, message: error instanceof Error ? error.message : String(error) }
          : unexpectedFailure(error)
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(response))
    },
  })
}
