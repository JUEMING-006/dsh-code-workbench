import { describe, expect, it, vi } from 'vitest'
import { GLOBAL_MODE_KEY, writeMode } from './store.ts'
import { switchMode } from './switch.ts'

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

describe('switchMode', () => {
  it('writes the target mode and reloads', () => {
    const s = memoryStorage()
    const reload = vi.fn()
    writeMode(s, 'workbench')
    switchMode(s, 'harness', reload)
    expect(s.storage.get(GLOBAL_MODE_KEY)).toBe('harness')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads even when the mode was already the target', () => {
    const s = memoryStorage()
    const reload = vi.fn()
    switchMode(s, 'harness', reload)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
