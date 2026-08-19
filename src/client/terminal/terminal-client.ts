/**
 * Terminal client: typed wrapper over the terminal gateway. Spawn/write/kill
 * ride the JSON POST carrier; output rides an SSE stream (EventSource).
 */

import { TERMINAL_ROUTE_PATH, TERMINAL_STREAM_PATH } from '../../shared/terminal-contract.ts'

/** Streamed events from the gateway. */
export type TerminalStreamEvent =
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null }

/** Fetch seam (browser global; injectable for tests). */
export type FetchLike = (url: string, init: { method: string; body: string }) => Promise<{ json(): Promise<unknown> }>

/** EventSource seam (browser global; injectable for tests). */
export type EventSourceLike = new (url: string) => {
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  close(): void
}

/** The operations the terminal panel needs. */
export interface TerminalClient {
  /** Spawn a shell session in a directory; resolves the session id. */
  spawn(cwd?: string): Promise<string>
  /** Write raw input to a session's stdin. */
  write(id: string, data: string): Promise<void>
  /** Kill a session. */
  kill(id: string): Promise<void>
  /**
   * Open the output stream for a session.
   * @param id - session id.
   * @param handlers - output/exit callbacks.
   * @returns a disposer closing the stream.
   */
  stream(id: string, handlers: { onOutput(data: string): void; onExit(code: number | null): void }): () => void
}

/** Build the client. */
export function createTerminalClient(
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
  EventSourceCtor: EventSourceLike | undefined = globalThis.EventSource as unknown as EventSourceLike | undefined,
): TerminalClient {
  const post = async (op: unknown): Promise<{ ok: boolean; value?: unknown; code?: string; message?: string }> => {
    let body: Record<string, unknown>
    try {
      body = await (await fetchImpl(TERMINAL_ROUTE_PATH, { method: 'POST', body: JSON.stringify(op) })).json() as Record<string, unknown>
    } catch (error) {
      throw new Error(`terminal transport failure: ${error instanceof Error ? error.message : String(error)}`)
    }
    return body as { ok: boolean; value?: unknown; code?: string; message?: string }
  }

  return {
    async spawn(cwd) {
      const response = await post(cwd === undefined ? { op: 'spawn' } : { op: 'spawn', cwd })
      if (!response.ok) throw new Error(`terminal spawn failed: ${response.message ?? response.code}`)
      const value = response.value as { id: string } | undefined
      if (value?.id === undefined) throw new Error('terminal spawn answered without an id')
      return value.id
    },
    async write(id, data) {
      const response = await post({ op: 'write', id, data })
      if (!response.ok) throw new Error(`terminal write failed: ${response.message ?? response.code}`)
    },
    async kill(id) {
      const response = await post({ op: 'kill', id })
      if (!response.ok) throw new Error(`terminal kill failed: ${response.message ?? response.code}`)
    },
    stream(id, handlers) {
      if (EventSourceCtor === undefined) {
        handlers.onExit(-1)
        return () => {}
      }
      const source = new EventSourceCtor(`${TERMINAL_STREAM_PATH}?id=${encodeURIComponent(id)}`)
      source.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as TerminalStreamEvent
          if (parsed.type === 'output') handlers.onOutput(parsed.data)
          else if (parsed.type === 'exit') handlers.onExit(parsed.code)
        } catch {
          // Malformed frame: ignore; the stream stays open.
        }
      }
      source.onerror = () => {
        handlers.onExit(null)
        source.close()
      }
      return () => { source.close() }
    },
  }
}
