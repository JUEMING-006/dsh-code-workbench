/**
 * Runtime Monaco loader: pulls the monaco-editor AMD distribution from the
 * host's static route (`/monaco`) instead of bundling it — the editor is
 * several megabytes and ships workers, so it must never inline into the
 * plugin client bundle. The first call injects the stylesheet and loader
 * script, configures the AMD base, and resolves once `window.monaco` exists;
 * later calls return the same promise.
 */

import type * as Monaco from 'monaco-editor'

declare global {
  interface Window {
    /** AMD loader installed by vs/loader.js. */
    require?: {
      config(options: { paths?: Record<string, string>; [key: string]: unknown }): void
      (deps: readonly string[], callback: () => void, errorCallback?: (err: unknown) => void): void
    }
    monaco?: typeof Monaco
    /** Worker routing for the editor distribution (see loadMonacoOnce). */
    MonacoEnvironment?: Monaco.Environment
  }
}

/** URL prefix the host serves the monaco distribution from. */
export const MONACO_BASE_URL = '/monaco'

let monacoPromise: Promise<typeof Monaco> | undefined

/** Load the editor once; concurrent callers share the in-flight promise. */
export function loadMonaco(): Promise<typeof Monaco> {
  monacoPromise ??= loadMonacoOnce()
  return monacoPromise
}

/** Load one script tag and wait for its load event. */
function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.dataset.monacoLoader = 'true'
    script.onload = () => { resolve() }
    script.onerror = () => { reject(new Error(`monaco: failed to load ${src}`)) }
    document.head.appendChild(script)
  })
}

async function loadMonacoOnce(): Promise<typeof Monaco> {
  // Worker routing: without this, workers resolve against the page URL and
  // 404. One shared worker main serves the editor's service workers; the
  // static route hosts the distribution.
  window.MonacoEnvironment = {
    getWorkerUrl: () => `${MONACO_BASE_URL}/vs/base/worker/workerMain.js`,
  }
  if (document.querySelector('link[data-monaco-css]') === null) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${MONACO_BASE_URL}/vs/editor/editor.main.css`
    link.dataset.monacoCss = 'true'
    document.head.appendChild(link)
  }
  if (document.querySelector('script[data-monaco-loader]') === null) {
    await injectScript(`${MONACO_BASE_URL}/vs/loader.js`)
  }
  await new Promise<void>((resolve, reject) => {
    if (window.require === undefined) {
      reject(new Error('monaco: vs/loader.js did not install the AMD require'))
      return
    }
    window.require.config({ paths: { vs: `${MONACO_BASE_URL}/vs` } })
    window.require(['vs/editor/editor.main'], () => { resolve() }, (error) => {
      reject(error instanceof Error ? error : new Error(String(error)))
    })
  })
  if (window.monaco === undefined) {
    throw new Error('monaco: editor.main loaded but window.monaco is undefined')
  }
  return window.monaco
}
