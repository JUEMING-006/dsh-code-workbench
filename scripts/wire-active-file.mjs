// Wires the active-file awareness through the gateway, host entry, and client.
import { readFileSync, writeFileSync } from 'node:fs'

const jobs = [
  {
    path: '../src/shared/fs-contract.ts',
    pairs: [
      {
        from: `export type FsGatewayOp =
  | { readonly op: 'listDir'; readonly path: string }
  | { readonly op: 'readText'; readonly path: string }
  | { readonly op: 'writeText'; readonly path: string; readonly content: string; readonly version?: string }`,
        to: `export type FsGatewayOp =
  | { readonly op: 'listDir'; readonly path: string }
  | { readonly op: 'readText'; readonly path: string }
  | { readonly op: 'writeText'; readonly path: string; readonly content: string; readonly version?: string }
  | { readonly op: 'noteActiveFile'; readonly path: string; readonly sessionId?: string }`,
      },
      {
        from: `export type FsGatewayValue =
  | { readonly kind: 'listDir'; readonly path: string; readonly entries: readonly FsEntryView[] }
  | { readonly kind: 'readText'; readonly file: FsTextFileView }
  | { readonly kind: 'writeText'; readonly path: string; readonly version: string }`,
        to: `export type FsGatewayValue =
  | { readonly kind: 'listDir'; readonly path: string; readonly entries: readonly FsEntryView[] }
  | { readonly kind: 'readText'; readonly file: FsTextFileView }
  | { readonly kind: 'writeText'; readonly path: string; readonly version: string }
  | { readonly kind: 'noteActiveFile' }`,
      },
    ],
  },
  {
    path: '../src/host/fs-gateway.ts',
    pairs: [
      {
        from: `import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge into this program.
import type {} from '@deepseek-ai/dsh-host-webserver'`,
        to: `import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge into this program.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import { noteActiveFile } from './active-file.ts'`,
      },
      {
        from: `    case 'writeText': {`,
        to: `    case 'noteActiveFile': {
      noteActiveFile(ctx, op.path, op.sessionId === undefined ? undefined : op.sessionId as SessionId)
      return { ok: true, value: { kind: 'noteActiveFile' } }
    }
    case 'writeText': {`,
      },
      {
        from: `  if (candidate.op === 'writeText') {
    if (typeof candidate.content !== 'string') throw new Error('writeText requires a string content')
    if (candidate.version !== undefined && typeof candidate.version !== 'string') {
      throw new Error('writeText version must be a string')
    }
  }`,
        to: `  if (candidate.op === 'writeText') {
    if (typeof candidate.content !== 'string') throw new Error('writeText requires a string content')
    if (candidate.version !== undefined && typeof candidate.version !== 'string') {
      throw new Error('writeText version must be a string')
    }
  }
  if (candidate.op === 'noteActiveFile' && candidate.sessionId !== undefined && typeof candidate.sessionId !== 'string') {
    throw new Error('noteActiveFile sessionId must be a string')
  }`,
      },
    ],
  },
  {
    path: '../src/host/index.ts',
    pairs: [
      {
        from: `import type { Context } from '@deepseek-ai/cordis'
import { installFsGateway } from './fs-gateway.ts'
import { installMonacoStatic } from './monaco-static.ts'
import { installTerminalGateway } from './terminal-gateway.ts'

/** Required services: the filesystem capability and the web route registry. */
export const inject = ['fs', 'webServer']`,
        to: `import type { Context } from '@deepseek-ai/cordis'
import { installActiveFileSection } from './active-file.ts'
import { installFsGateway } from './fs-gateway.ts'
import { installMonacoStatic } from './monaco-static.ts'
import { installTerminalGateway } from './terminal-gateway.ts'

/** Required services: the filesystem capability, the web route registry, and the model-facing seams. */
export const inject = ['fs', 'webServer', 'agents', 'systemPrompt']`,
      },
      {
        from: `export function apply(ctx: Context): void {
  ctx.effect(() => installFsGateway(ctx), 'code-workbench: fs gateway route')
  ctx.effect(() => installMonacoStatic(ctx), 'code-workbench: monaco static route')
  ctx.effect(() => installTerminalGateway(ctx), 'code-workbench: terminal gateway routes')
}`,
        to: `export function apply(ctx: Context): void {
  ctx.effect(() => installFsGateway(ctx), 'code-workbench: fs gateway route')
  ctx.effect(() => installMonacoStatic(ctx), 'code-workbench: monaco static route')
  ctx.effect(() => installTerminalGateway(ctx), 'code-workbench: terminal gateway routes')
  ctx.effect(() => installActiveFileSection(ctx), 'code-workbench: active-file prompt section')
}`,
      },
    ],
  },
  {
    path: '../src/client/fs/client.ts',
    pairs: [
      {
        from: `export interface FsClient {
  listDir(path: string): Promise<{ path: string; entries: readonly FsEntryView[] }>
  readText(path: string): Promise<FsTextFileView>
  writeText(path: string, content: string, version?: string): Promise<{ path: string; version: string }>
}`,
        to: `export interface FsClient {
  listDir(path: string): Promise<{ path: string; entries: readonly FsEntryView[] }>
  readText(path: string): Promise<FsTextFileView>
  writeText(path: string, content: string, version?: string): Promise<{ path: string; version: string }>
  /** Report the editor's active file to the host (model-visible context). */
  noteActiveFile(path: string, sessionId?: string): Promise<void>
}`,
      },
      {
        from: `    async writeText(path, content, version) {
      const response = await call(version === undefined
        ? { op: 'writeText', path, content }
        : { op: 'writeText', path, content, version })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'writeText') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      return { path: response.value.path, version: response.value.version }
    },`,
        to: `    async writeText(path, content, version) {
      const response = await call(version === undefined
        ? { op: 'writeText', path, content }
        : { op: 'writeText', path, content, version })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'writeText') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      return { path: response.value.path, version: response.value.version }
    },
    async noteActiveFile(path, sessionId) {
      const response = await call(sessionId === undefined
        ? { op: 'noteActiveFile', path }
        : { op: 'noteActiveFile', path, sessionId })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
    },`,
      },
    ],
  },
]

for (const job of jobs) {
  const p = new URL(job.path, import.meta.url)
  let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')
  for (const { from, to } of job.pairs) {
    if (s.includes(to)) continue
    if (!s.includes(from)) {
      console.error('NOT FOUND in', job.path, ':', from.slice(0, 60).replaceAll('\n', '\\n'))
      continue
    }
    s = s.replace(from, to)
    console.log('patched:', job.path)
  }
  writeFileSync(p, s)
}
