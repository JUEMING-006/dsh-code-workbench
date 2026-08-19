import { describe, expect, it } from 'vitest'
import {
  clearSessionMode, DEFAULT_MODE, GLOBAL_MODE_KEY, isShellMode, readGlobalMode, readMode,
  SESSION_MODE_PREFIX, writeMode,
} from './store.ts'

/** In-memory storage double for the localStorage axis. */
function memoryStorage(): { storage: Map<string, string>; getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  const storage = new Map<string, string>()
  return {
    storage,
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => { storage.set(k, v) },
    removeItem: (k) => { storage.delete(k) },
  }
}

describe('isShellMode', () => {
  it('accepts the two known modes', () => {
    expect(isShellMode('harness')).toBe(true)
    expect(isShellMode('workbench')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isShellMode('vscode')).toBe(false)
    expect(isShellMode('')).toBe(false)
    expect(isShellMode(null)).toBe(false)
    expect(isShellMode(undefined)).toBe(false)
  })
})

describe('global mode', () => {
  it('defaults to harness on an empty store', () => {
    const s = memoryStorage()
    expect(readGlobalMode(s)).toBe(DEFAULT_MODE)
  })

  it('round-trips a written global mode', () => {
    const s = memoryStorage()
    writeMode(s, 'workbench')
    expect(s.storage.get(GLOBAL_MODE_KEY)).toBe('workbench')
    expect(readGlobalMode(s)).toBe('workbench')
  })

  it('treats a malformed stored value as harness', () => {
    const s = memoryStorage()
    s.storage.set(GLOBAL_MODE_KEY, 'weird')
    expect(readGlobalMode(s)).toBe('harness')
  })
})

describe('per-session override', () => {
  it('wins over the global default', () => {
    const s = memoryStorage()
    writeMode(s, 'workbench')
    writeMode(s, 'harness', 'session-a')
    expect(readMode(s, 'session-a')).toBe('harness')
    expect(readMode(s, 'session-b')).toBe('workbench')
  })

  it('stores overrides under the prefixed key', () => {
    const s = memoryStorage()
    writeMode(s, 'workbench', 'session-a')
    expect(s.storage.get(`${SESSION_MODE_PREFIX}session-a`)).toBe('workbench')
  })

  it('falls back to the global value after the override is cleared', () => {
    const s = memoryStorage()
    writeMode(s, 'workbench')
    writeMode(s, 'harness', 'session-a')
    clearSessionMode(s, 'session-a')
    expect(s.storage.has(`${SESSION_MODE_PREFIX}session-a`)).toBe(false)
    expect(readMode(s, 'session-a')).toBe('workbench')
  })

  it('ignores a malformed override value', () => {
    const s = memoryStorage()
    s.storage.set(`${SESSION_MODE_PREFIX}session-a`, 'vscode')
    expect(readMode(s, 'session-a')).toBe('harness')
  })
})
