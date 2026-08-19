/**
 * Terminal gateway: a pipe-mode shell session bridge for the workbench panel.
 *
 * Pipes, not PTYs: each session spawns a shell child with piped stdio and the
 * gateway relays output over an SSE stream and input over POST writes. This
 * keeps the plugin free of native modules (node-pty) while still delivering a
 * usable interactive terminal (with the documented limits: no TTY job
 * control, no resize signals). Sessions are keyed by a gateway-minted id and
 * die with the process or the plugin.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { TERMINAL_ROUTE_PATH, TERMINAL_STREAM_PATH } from '../shared/terminal-contract.ts'

/** URL serving the xterm stylesheet (the panel links it once). */
export const XTERM_CSS_PATH = '/xterm/xterm.css'

/** The shell binary and default arguments for the host platform. */
function defaultShell(): { binary: string; args: string[] } {
  if (process.platform === 'win32') {
    const initCommand = [
      '[Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()',
      '$OutputEncoding = [System.Text.UTF8Encoding]::new()',
      'chcp 65001 >$null',
      'Clear-Host',
    ].join('; ')
    return {
      binary: 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', initCommand],
    }
  }
  return { binary: process.env.SHELL ?? '/bin/bash', args: [] }
}

/** One live pipe-mode session. */
interface TerminalSession {
  readonly id: string
  readonly proc: ChildProcessWithoutNullStreams
  readonly cwd: string
}

const sessions = new Map<string, TerminalSession>()

let nextId = 0

function mintId(): string {
  nextId += 1
  return `wb-${nextId}`
}

/** Narrow a JSON body to a terminal operation. */
type TerminalOp =
  | { op: 'spawn'; cwd?: string }
  | { op: 'write'; id: string; data: string }
  | { op: 'kill'; id: string }

function parseOp(body: unknown): TerminalOp {
  if (typeof body !== 'object' || body === null) throw new Error('terminal request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  switch (candidate.op) {
    case 'spawn':
      if (candidate.cwd !== undefined && typeof candidate.cwd !== 'string') throw new Error('spawn cwd must be a string')
      return { op: 'spawn', ...(candidate.cwd === undefined ? {} : { cwd: candidate.cwd }) }
    case 'write':
    case 'kill':
      if (typeof candidate.id !== 'string' || candidate.id.length === 0) throw new Error('terminal op requires an id')
      if (candidate.op === 'write' && typeof candidate.data !== 'string') throw new Error('write requires string data')
      return candidate as TerminalOp
    default:
      throw new Error(`unknown terminal op "${String(candidate.op)}"`)
  }
}

/** Read a small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Respond JSON. */
function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/**
 * Install the terminal routes.
 * @param ctx - root context carrying webServer.
 * @returns disposer that kills every live session and removes the routes.
 */
export function installTerminalGateway(ctx: Context): () => void {
  const control = ctx.webServer.register({
    kind: 'exact',
    path: TERMINAL_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'terminal gateway accepts POST only' })
        return
      }
      let op: TerminalOp
      try {
        op = parseOp(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        switch (op.op) {
          case 'spawn': {
            const id = mintId()
            const { binary, args } = defaultShell()
            const proc = spawn(binary, args, {
              cwd: op.cwd,
              env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1',
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8',
              },
              stdio: ['pipe', 'pipe', 'pipe'],
              windowsHide: true,
            })
            sessions.set(id, { id, proc, cwd: op.cwd ?? process.cwd() })
            proc.on('exit', () => { sessions.delete(id) })
            json(res, 200, { ok: true, value: { id, shell: binary } })
            return
          }
          case 'write': {
            const session = sessions.get(op.id)
            if (session === undefined) {
              json(res, 404, { ok: false, code: 'NO_SESSION', message: `terminal session ${op.id} is not live` })
              return
            }
            const data = process.platform === 'win32'
              ? op.data.replace(/\r(?!\n)/gu, '\r\n')
              : op.data
            session.proc.stdin.write(data)
            json(res, 200, { ok: true, value: { accepted: true } })
            return
          }
          case 'kill': {
            const session = sessions.get(op.id)
            if (session === undefined) {
              json(res, 404, { ok: false, code: 'NO_SESSION', message: `terminal session ${op.id} is not live` })
              return
            }
            session.proc.kill()
            sessions.delete(op.id)
            json(res, 200, { ok: true, value: { killed: true } })
            return
          }
        }
      } catch (error) {
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  const stream = ctx.webServer.register({
    kind: 'exact',
    path: TERMINAL_STREAM_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const url = new URL(req.url ?? '/', 'http://x')
      const id = url.searchParams.get('id') ?? ''
      const session = sessions.get(id)
      if (session === undefined) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, code: 'NO_SESSION', message: `terminal session ${id} is not live` }))
        return
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write('retry: 3000\n\n')
      let closed = false
      const close = (): void => { closed = true }
      req.on('close', close)
      const push = (payload: unknown): void => {
        if (closed) return
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }
      const onOutput = (data: Buffer): void => { push({ type: 'output', data: data.toString('utf8') }) }
      session.proc.stdout.on('data', onOutput)
      session.proc.stderr.on('data', onOutput)
      const onExit = (code: number | null): void => {
        push({ type: 'exit', code })
        res.end()
      }
      session.proc.once('exit', onExit)
      req.on('close', () => {
        session.proc.stdout.off('data', onOutput)
        session.proc.stderr.off('data', onOutput)
        session.proc.off('exit', onExit)
      })
    },
  })

  const css = ctx.webServer.register({
    kind: 'exact',
    path: XTERM_CSS_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      try {
        const require = createRequire(import.meta.url)
        const cssFile = require.resolve('@xterm/xterm/css/xterm.css')
        const body = await readFile(cssFile)
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end()
      }
    },
  })

  return () => {
    control()
    stream()
    css()
    for (const session of sessions.values()) session.proc.kill()
    sessions.clear()
  }
}
