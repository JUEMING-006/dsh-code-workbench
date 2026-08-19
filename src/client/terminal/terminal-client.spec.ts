/**
 * Terminal client tests: POST codec, typed failures, and the SSE stream
 * (EventSource double driving message/error frames).
 */
import { describe, expect, it, vi } from 'vitest'
import { createTerminalClient, type EventSourceLike, type FetchLike } from './terminal-client.ts'

/** Fetch double answering from canned gateway responses. */
function fetchWith(respond: (op: unknown) => { ok: boolean; value?: unknown; code?: string; message?: string }) {
  const sent: unknown[] = []
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    const op = JSON.parse(init.body) as unknown
    sent.push(op)
    return { ok: true, json: async () => respond(op) }
  }) as unknown as FetchLike
  return { fetchImpl, sent: () => sent[0] }
}

/** EventSource double recording handlers for later driving. */
function eventSourceDouble(): { Ctor: EventSourceLike; instances: Array<{ url: string; onmessage: ((e: { data: string }) => void) | null; onerror: ((e: unknown) => void) | null; closed: boolean }> } {
  const instances: Array<{ url: string; onmessage: ((e: { data: string }) => void) | null; onerror: ((e: unknown) => void) | null; closed: boolean }> = []
  const Ctor = class {
    onmessage: ((e: { data: string }) => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    closed = false
    constructor(readonly url: string) {
      instances.push(this)
    }
    close(): void {
      this.closed = true
    }
  } as unknown as EventSourceLike
  return { Ctor, instances }
}

describe('terminal client', () => {
  it('spawns a session and returns its id', async () => {
    const { fetchImpl, sent } = fetchWith(() => ({ ok: true, value: { id: 'wb-1' } }))
    const id = await createTerminalClient(fetchImpl).spawn('/w')
    expect(id).toBe('wb-1')
    expect(sent()).toEqual({ op: 'spawn', cwd: '/w' })
  })

  it('spawns without a cwd when none is given', async () => {
    const { fetchImpl, sent } = fetchWith(() => ({ ok: true, value: { id: 'wb-1' } }))
    await createTerminalClient(fetchImpl).spawn()
    expect(sent()).toEqual({ op: 'spawn' })
  })

  it('writes raw input', async () => {
    const { fetchImpl, sent } = fetchWith(() => ({ ok: true, value: { accepted: true } }))
    await createTerminalClient(fetchImpl).write('wb-1', 'ls\r\n')
    expect(sent()).toEqual({ op: 'write', id: 'wb-1', data: 'ls\r\n' })
  })

  it('surfaces spawn failures', async () => {
    const { fetchImpl } = fetchWith(() => ({ ok: false, code: 'NO_BACKEND', message: 'no shell' }))
    await expect(createTerminalClient(fetchImpl).spawn()).rejects.toThrow(/no shell/)
  })

  it('streams output and exit events over EventSource', () => {
    const { fetchImpl } = fetchWith(() => ({ ok: true, value: { id: 'wb-1' } }))
    const { Ctor, instances } = eventSourceDouble()
    const client = createTerminalClient(fetchImpl, Ctor)
    const onOutput = vi.fn()
    const onExit = vi.fn()
    const close = client.stream('wb-1', { onOutput, onExit })
    const source = instances[0]!
    expect(source.url).toContain('/terminal/stream?id=wb-1')
    source.onmessage?.({ data: JSON.stringify({ type: 'output', data: 'hi' }) })
    expect(onOutput).toHaveBeenCalledWith('hi')
    source.onmessage?.({ data: JSON.stringify({ type: 'exit', code: 0 }) })
    expect(onExit).toHaveBeenCalledWith(0)
    close()
    expect(source.closed).toBe(true)
  })

  it('closes the stream on transport error', () => {
    const { fetchImpl } = fetchWith(() => ({ ok: true, value: { id: 'wb-1' } }))
    const { Ctor, instances } = eventSourceDouble()
    const client = createTerminalClient(fetchImpl, Ctor)
    const onExit = vi.fn()
    client.stream('wb-1', { onOutput: vi.fn(), onExit })
    instances[0]!.onerror?.({})
    expect(onExit).toHaveBeenCalled()
    expect(instances[0]!.closed).toBe(true)
  })
})
