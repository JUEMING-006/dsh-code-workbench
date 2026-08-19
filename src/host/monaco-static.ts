/**
 * Monaco static resource route: serves the monaco-editor AMD distribution
 * (`min/vs/*`) to the browser over `/monaco/*`, replacing a CDN for offline
 * and LAN deployments. The browser half loads loader.js from here and
 * resolves `vs` paths against it; workers and CSS ride the same prefix.
 */

import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** URL prefix serving the monaco-editor distribution. */
export const MONACO_ROUTE_PATH = '/monaco'

/** Content types for the assets the monaco distribution ships. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
}

/** Resolve the monaco distribution root (…/min/vs) from this package. */
function monacoVsRoot(): string {
  const require = createRequire(import.meta.url)
  const editorMain = require.resolve('monaco-editor/min/vs/editor/editor.main.js')
  return resolve(dirname(editorMain), '..', '..')
}

/**
 * Install the monaco static route.
 * @param ctx - root context carrying webServer.
 * @returns the route disposer.
 */
export function installMonacoStatic(ctx: Context): () => void {
  const root = monacoVsRoot()
  return ctx.webServer.register({
    kind: 'prefix',
    path: MONACO_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
      const relative = pathname.slice(MONACO_ROUTE_PATH.length + 1)
      // Traversal fence: the resolved file must stay under the distribution
      // root, or the route becomes a file-read primitive for any URL.
      const file = resolve(root, relative)
      if (file !== root && !file.startsWith(`${root}${sep}`)) {
        res.writeHead(404)
        res.end()
        return
      }
      try {
        const body = await readFile(file)
        res.writeHead(200, {
          'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'public, max-age=3600',
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      } catch {
        res.writeHead(404)
        res.end()
      }
    },
  })
}
