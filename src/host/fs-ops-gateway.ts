/**
 * Host fs-ops gateway: the structural mutations the filesystem capability
 * does not expose (mkdir / rename / remove) for the workbench browser half,
 * over `/api/code-workbench/fs-ops`.
 *
 * Every op runs the same gates the fs gateway runs: the client names the
 * workspace root, the host resolves both root and target through the
 * backend (whose own confinement applies) and then requires canonical
 * containment (`fs.contains`) — `..` and absolute escapes fail loud — and
 * the mutation rides the `fs/write-intent` waterfall with the workbench
 * actor before the Node primitives touch the process path. Outcomes are
 * recorded through `fs/observed` so the observation policy keeps its
 * read-before-edit state coherent.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, rename, rm } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge into this program.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { FileSystem, FsTarget } from '@deepseek-ai/dsh-fs'
import { FS_OPS_ROUTE_PATH } from '../shared/fs-contract.ts'
import type { FsOpsOp, FsOpsResponse } from '../shared/fs-contract.ts'
import { WORKBENCH_ACTOR, normalizeHostPath } from './fs-gateway.ts'

/** Read a small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Narrow an unknown JSON body to a structural op. */
function parseOp(body: unknown): FsOpsOp {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  if (candidate.op !== 'mkdir' && candidate.op !== 'rename' && candidate.op !== 'remove') {
    throw new Error(`unknown fs-ops op "${String(candidate.op)}"`)
  }
  if (typeof candidate.root !== 'string' || candidate.root.length === 0) {
    throw new Error('fs-ops op requires a non-empty string root')
  }
  if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
    throw new Error('fs-ops op requires a non-empty string path')
  }
  if (candidate.op === 'rename' && (typeof candidate.newPath !== 'string' || candidate.newPath.length === 0)) {
    throw new Error('rename requires a non-empty string newPath')
  }
  return candidate as unknown as FsOpsOp
}

/** Respond JSON with the given status. */
function json(res: ServerResponse, status: number, payload: FsOpsResponse): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/**
 * Resolve the client-named target inside the client-named root and require
 * canonical containment. Both resolve calls go through the backend, whose
 * own confinement applies first; `fs.contains` then rejects anything the
 * backend mapped outside the root (a `..` escape, a sibling workspace, an
 * absolute path elsewhere).
 */
async function resolveInside(fs: FileSystem, root: string, path: string): Promise<{ rootTarget: FsTarget; childTarget: FsTarget }> {
  const rootTarget = await fs.resolve(normalizeHostPath(root))
  const rootInfo = await fs.stat(rootTarget)
  if (rootInfo === undefined || rootInfo.type !== 'directory') {
    throw new Error(`fs-ops root "${root}" is not a directory`)
  }
  const childTarget = await fs.resolve(normalizeHostPath(path))
  if (!fs.contains(rootTarget, childTarget)) {
    throw new Error(`fs-ops path "${path}" escapes the workspace root "${root}"`)
  }
  return { rootTarget, childTarget }
}

/** Run one structural op against the policy-armed filesystem. */
async function dispatch(ctx: Context, fs: FileSystem, op: FsOpsOp): Promise<FsOpsResponse> {
  // The write-intent waterfall is the policy gate (a denial throws its own
  // code); the produced intent has no meaning for structural ops and is
  // deliberately discarded.
  const gate = async (target: FsTarget): Promise<void> => {
    await ctx.waterfall('fs/write-intent', target, WORKBENCH_ACTOR, () => undefined)
  }
  switch (op.op) {
    case 'mkdir': {
      const { childTarget } = await resolveInside(fs, op.root, op.path)
      await gate(childTarget)
      await mkdir(fs.processPath(childTarget))
      const info = await fs.stat(childTarget)
      if (info !== undefined) ctx.emit('fs/observed', childTarget, { kind: 'present', version: info.version }, WORKBENCH_ACTOR)
      return { ok: true, value: { kind: 'mkdir', path: childTarget.displayPath } }
    }
    case 'rename': {
      const from = await resolveInside(fs, op.root, op.path)
      const to = await resolveInside(fs, op.root, op.newPath)
      await gate(to.childTarget)
      await rename(fs.processPath(from.childTarget), fs.processPath(to.childTarget))
      const info = await fs.stat(to.childTarget)
      if (info !== undefined) ctx.emit('fs/observed', to.childTarget, { kind: 'present', version: info.version }, WORKBENCH_ACTOR)
      ctx.emit('fs/observed', from.childTarget, { kind: 'absent' }, WORKBENCH_ACTOR)
      return { ok: true, value: { kind: 'rename', path: from.childTarget.displayPath, newPath: to.childTarget.displayPath } }
    }
    case 'remove': {
      const { childTarget } = await resolveInside(fs, op.root, op.path)
      await gate(childTarget)
      await rm(fs.processPath(childTarget), { recursive: true })
      ctx.emit('fs/observed', childTarget, { kind: 'absent' }, WORKBENCH_ACTOR)
      return { ok: true, value: { kind: 'remove', path: childTarget.displayPath } }
    }
  }
}

/**
 * Install the fs-ops gateway route.
 * @param ctx - root context carrying fs and webServer.
 * @returns the route disposer.
 */
export function installFsOpsGateway(ctx: Context): () => void {
  const fs = ctx.fs
  return ctx.webServer.register({
    kind: 'prefix',
    path: FS_OPS_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'fs-ops gateway accepts POST only' })
        return
      }
      let op: FsOpsOp
      try {
        op = parseOp(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        json(res, 200, await dispatch(ctx, fs, op))
      } catch (error) {
        // Escape and policy denials are client mistakes/denials, not server
        // faults: 403 with the reason; everything else is a gateway failure.
        const message = error instanceof Error ? error.message : String(error)
        const code = (error as { code?: unknown } | null)?.code
        const denied = typeof code === 'string' && (code === 'FS_SANDBOX_DENIED' || code === 'FS_PERMISSION_DENIED')
        if (message.includes('escapes the workspace root') || denied) {
          json(res, 403, { ok: false, code: denied ? code : 'FS_OUTSIDE_ROOT', message })
          return
        }
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message })
      }
    },
  })
}
