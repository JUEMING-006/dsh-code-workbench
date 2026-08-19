/**
 * Browser fs client: typed fetch wrapper over the host fs gateway. The wire
 * vocabulary lives in the shared contract; this module owns transport only
 * (URL, method, JSON codec) and surfaces typed values or typed failures.
 */

import { FS_ROUTE_PATH, FS_OPS_ROUTE_PATH, SEARCH_ROUTE_PATH, REPLACE_ROUTE_PATH } from '../../shared/fs-contract.ts'
import type {
  FsEntryView, FsGatewayOp, FsGatewayResponse, FsOpsOp, FsOpsResponse, FsTextFileView,
  SearchRequest, SearchResponse, SearchMatchView, SearchSuccess,
  ReplaceRequest, ReplaceResponse, ReplaceSuccess,
} from '../../shared/fs-contract.ts'

/** A failed gateway round-trip, carrying the stable machine code. */
export class FsGatewayError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'FsGatewayError'
  }
}

/** Transport seam (globalThis.fetch in the browser; injectable for tests). */
export type FetchLike = (url: string, init: { method: string; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>

/** Parent directory of a path ('' for a bare name); separators stay native. */
export function dirnameOf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/u, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return index <= 0 ? '' : trimmed.slice(0, index)
}

/** Final path segment, cross-platform. */
export function basenameOf(path: string): string {
  return path.split(/[/\\]/u).filter(Boolean).pop() ?? path
}

/** The structural mutations the explorer needs (host fs-ops gateway). */
export interface FsOpsClient {
  mkdir(root: string, path: string): Promise<{ path: string }>
  rename(root: string, path: string, newPath: string): Promise<{ path: string; newPath: string }>
  remove(root: string, path: string): Promise<{ path: string }>
}

/** The operations the file explorer and editor need. */
export interface FsClient {
  listDir(path: string): Promise<{ path: string; entries: readonly FsEntryView[] }>
  /** Recursive workspace file listing (root-relative paths, bounded walk). */
  listAll(path: string): Promise<{ root: string; files: readonly string[] }>
  readText(path: string): Promise<FsTextFileView>
  writeText(path: string, content: string, version?: string): Promise<{ path: string; version: string }>
  /** Report the editor's active file to the host (model-visible context). */
  noteActiveFile(path: string, sessionId?: string): Promise<void>
  /** Grep the workspace for a literal pattern, returning matches with context. */
  search(request: SearchRequest): Promise<{ root: string; pattern: string; matches: readonly SearchMatchView[]; truncated: boolean }>
  /** Single-file string replace with version guard. */
  replace(request: ReplaceRequest): Promise<{ path: string; version: string }>
}

/** Build the client. */
export function createFsClient(
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
  baseUrl: string = FS_ROUTE_PATH,
): FsClient {
  const call = async (op: FsGatewayOp): Promise<FsGatewayResponse> => {
    let response: unknown
    try {
      response = await (await fetchImpl(baseUrl, { method: 'POST', body: JSON.stringify(op) })).json()
    } catch (error) {
      throw new FsGatewayError('TRANSPORT_ERROR', error instanceof Error ? error.message : String(error))
    }
    return response as FsGatewayResponse
  }

  return {
    async listDir(path) {
      const response = await call({ op: 'listDir', path })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'listDir') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      return { path: response.value.path, entries: response.value.entries }
    },
    async listAll(path) {
      const response = await call({ op: 'listAll', path })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'listAll') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      return { root: response.value.root, files: response.value.files }
    },
    async readText(path) {
      const response = await call({ op: 'readText', path })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'readText') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      return response.value.file
    },
    async writeText(path, content, version) {
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
    },
    async search(request) {
      let response: unknown
      try {
        response = await (await fetchImpl(SEARCH_ROUTE_PATH, { method: 'POST', body: JSON.stringify(request) })).json()
      } catch (error) {
        throw new FsGatewayError('TRANSPORT_ERROR', error instanceof Error ? error.message : String(error))
      }
      const parsed = response as SearchResponse
      if (!parsed.ok) throw new FsGatewayError(parsed.code, parsed.message)
      if (parsed.value.kind !== 'search') throw new FsGatewayError('BAD_RESPONSE', 'gateway answered with a different op')
      const value = parsed.value as SearchSuccess['value']
      return { root: value.root, pattern: value.pattern, matches: value.matches, truncated: value.truncated }
    },
    async replace(request) {
      let response: unknown
      try {
        response = await (await fetchImpl(REPLACE_ROUTE_PATH, { method: 'POST', body: JSON.stringify(request) })).json()
      } catch (error) {
        throw new FsGatewayError('TRANSPORT_ERROR', error instanceof Error ? error.message : String(error))
      }
      const parsed = response as ReplaceResponse
      if (!parsed.ok) throw new FsGatewayError(parsed.code, parsed.message)
      const value = parsed.value as ReplaceSuccess['value']
      return { path: value.path, version: value.version }
    },
  }
}

/**
 * Build the structural-ops client over `/api/code-workbench/fs-ops`. The
 * workspace root travels with every call — the host resolves it through the
 * backend and enforces canonical containment before mutating anything.
 */
export function createFsOpsClient(
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
  baseUrl: string = FS_OPS_ROUTE_PATH,
): FsOpsClient {
  const call = async (op: FsOpsOp): Promise<FsOpsResponse> => {
    let response: unknown
    try {
      response = await (await fetchImpl(baseUrl, { method: 'POST', body: JSON.stringify(op) })).json()
    } catch (error) {
      throw new FsGatewayError('TRANSPORT_ERROR', error instanceof Error ? error.message : String(error))
    }
    return response as FsOpsResponse
  }

  return {
    async mkdir(root, path) {
      const response = await call({ op: 'mkdir', root, path })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'mkdir') throw new FsGatewayError('BAD_RESPONSE', 'fs-ops gateway answered with a different op')
      return { path: response.value.path }
    },
    async rename(root, path, newPath) {
      const response = await call({ op: 'rename', root, path, newPath })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'rename') throw new FsGatewayError('BAD_RESPONSE', 'fs-ops gateway answered with a different op')
      return { path: response.value.path, newPath: response.value.newPath }
    },
    async remove(root, path) {
      const response = await call({ op: 'remove', root, path })
      if (!response.ok) throw new FsGatewayError(response.code, response.message)
      if (response.value.kind !== 'remove') throw new FsGatewayError('BAD_RESPONSE', 'fs-ops gateway answered with a different op')
      return { path: response.value.path }
    },
  }
}
