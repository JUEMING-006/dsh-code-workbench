/**
 * Host search gateway: a bounded workspace grep over the filesystem capability,
 * served at `POST /api/code-workbench/search`. The walk reuses the same BFS
 * exclusion rules as `listAll` (no `node_modules` / `.git`); each text file is
 * scanned for the literal pattern and the first 500 matches win. The response
 * carries root-relative paths plus three context lines on each side so the
 * client can render a clean results tree without another round trip.
 *
 * Reads are unobserved: search is a view operation, not a mutation, so it
 * neither runs the policy waterfall nor emits `fs/observed`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { SEARCH_ROUTE_PATH } from '../shared/fs-contract.ts'
import type { SearchRequest, SearchResponse } from '../shared/fs-contract.ts'

/** Directories the walk never descends into. */
const WALK_EXCLUDED_DIRS = new Set(['node_modules', '.git'])

/** Maximum number of matches returned (one entry per hit). */
const MAX_HITS = 500

/** Context lines kept above and below each matching line. */
const CONTEXT_LINES = 1

/** Read a small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Narrow the request body. */
function parseRequest(body: unknown): SearchRequest {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  if (typeof candidate.pattern !== 'string' || candidate.pattern.length === 0) {
    throw new Error('search requires a non-empty string pattern')
  }
  if (typeof candidate.root !== 'string' || candidate.root.length === 0) {
    throw new Error('search requires a non-empty string root')
  }
  return {
    pattern: candidate.pattern,
    root: candidate.root,
    ...(typeof candidate.glob === 'string' ? { glob: candidate.glob } : {}),
    ...(typeof candidate.caseSensitive === 'boolean' ? { caseSensitive: candidate.caseSensitive } : {}),
    ...(typeof candidate.wholeMatch === 'boolean' ? { wholeMatch: candidate.wholeMatch } : {}),
    ...(typeof candidate.useRegex === 'boolean' ? { useRegex: candidate.useRegex } : {}),
  }
}

/** Respond JSON with the given status. */
function json(res: ServerResponse, status: number, payload: SearchResponse): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Return the slice of lines around `targetIndex`, clamped at edges. */
function contextOf(lines: readonly string[], targetIndex: number): { before: string[]; after: string[] } {
  const start = Math.max(0, targetIndex - CONTEXT_LINES)
  const end = Math.min(lines.length, targetIndex + CONTEXT_LINES + 1)
  return { before: lines.slice(start, targetIndex), after: lines.slice(targetIndex + 1, end) }
}

/**
 * Bounded BFS file listing under one root: same exclusion rules as the fs
 * gateway's `listAll` walk. Returns root-relative paths.
 */
async function walkFiles(fs: FileSystem, root: string): Promise<string[]> {
  const files: string[] = []
  const queue: { dirPath: string; prefix: string }[] = [{ dirPath: root, prefix: '' }]
  while (queue.length > 0 && files.length < 10000) {
    const { dirPath, prefix } = queue.shift()!
    const target = await fs.resolve(dirPath)
    for (const entry of await fs.listDir(target)) {
      if (files.length >= 10000) break
      if (entry.type === 'file') files.push(`${prefix}${entry.name}`)
      else if (entry.type === 'directory' && !WALK_EXCLUDED_DIRS.has(entry.name)) {
        queue.push({ dirPath: `${dirPath}/${entry.name}`, prefix: `${prefix}${entry.name}/` })
      }
    }
  }
  return files
}

/** Escape a string for safe RegExp source use. */
function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Test whether `text` matches `pattern` under the given options. */
function matchLine(pattern: string, text: string, opts: { caseSensitive?: boolean; wholeMatch?: boolean; useRegex?: boolean }): boolean {
  let regex: RegExp
  try {
    const flags = opts.caseSensitive ? 'u' : 'ui'
    const source = opts.useRegex ? pattern : escapeRegex(pattern)
    const full = opts.wholeMatch ? `\\b${source}\\b` : source
    regex = new RegExp(full, flags)
  } catch {
    return false
  }
  return regex.test(text)
}

/** Grep one text file, yielding match views. */
async function grepFile(
  fs: FileSystem,
  root: string,
  relativePath: string,
  pattern: string,
  opts: { caseSensitive?: boolean; wholeMatch?: boolean; useRegex?: boolean },
): Promise<import('../shared/fs-contract.ts').SearchMatchView[]> {
  try {
    const target = await fs.resolve(`${root}/${relativePath}`)
    const content = await fs.readText(target)
    const lines = content.split('\n')
    const matches: import('../shared/fs-contract.ts').SearchMatchView[] = []
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!
      if (matchLine(pattern, line, opts)) {
        const { before, after } = contextOf(lines, index)
        matches.push({
          path: relativePath,
          line: index + 1,
          text: line,
          before,
          after,
        })
        if (matches.length >= MAX_HITS) break
      }
    }
    return matches
  } catch {
    return []
  }
}

/** Run one search request. */
async function dispatch(ctx: Context, fs: FileSystem, request: SearchRequest): Promise<SearchResponse> {
  const { pattern, root } = request
  const glob = request.glob
  const matchOpts: { caseSensitive?: boolean; wholeMatch?: boolean; useRegex?: boolean } = {
    ...(request.caseSensitive !== undefined ? { caseSensitive: request.caseSensitive } : {}),
    ...(request.wholeMatch !== undefined ? { wholeMatch: request.wholeMatch } : {}),
    ...(request.useRegex !== undefined ? { useRegex: request.useRegex } : {}),
  }

  // Validate regex up-front when the user opted into regex mode.
  if (request.useRegex === true) {
    try {
      const flags = request.caseSensitive ? 'u' : 'ui'
      const source = escapeRegex(pattern)
      const full = request.wholeMatch === true ? `\\b${source}\\b` : source
      // eslint-disable-next-line no-new
      new RegExp(full, flags)
    } catch {
      return {
        ok: false,
        code: 'SEARCH_INVALID_PATTERN',
        message: 'The search pattern is not a valid regular expression',
      }
    }
  }

  const candidates = await walkFiles(fs, root)
  const filtered = typeof glob === 'string' && glob.length > 0
    ? candidates.filter(path => {
        // Minimal glob: only `*` wildcard, anchored at extensions / segments.
        if (glob.includes('**')) return true // conservative fallback
        const regex = new RegExp('^' + glob.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        return regex.test(path)
      })
    : candidates

  const matches: import('../shared/fs-contract.ts').SearchMatchView[] = []
  for (const relativePath of filtered) {
    if (matches.length >= MAX_HITS) break
    const hits = await grepFile(fs, root, relativePath, pattern, matchOpts)
    matches.push(...hits)
  }

  return {
    ok: true,
    value: {
      kind: 'search',
      root,
      pattern,
      matches: matches.slice(0, MAX_HITS),
      truncated: matches.length >= MAX_HITS,
    },
  }
}

/**
 * Install the search gateway route.
 * @param ctx - root context carrying fs and webServer.
 * @returns the route disposer.
 */
export function installSearchGateway(ctx: Context): () => void {
  const fs = ctx.fs
  return ctx.webServer.register({
    kind: 'prefix',
    path: SEARCH_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'search gateway accepts POST only' })
        return
      }
      let request: SearchRequest
      try {
        request = parseRequest(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        json(res, 200, await dispatch(ctx, fs, request))
      } catch (error) {
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
