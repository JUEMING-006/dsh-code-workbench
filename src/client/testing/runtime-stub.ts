/**
 * Test-only stand-in for the client-runtime snapshot-store engine.
 *
 * The published @deepseek-ai/dsh-client-runtime `./client` export is a
 * browser closure-factory bundle (it registers itself with
 * window.__ModuleLoader__), which Node tests cannot execute. This stub
 * implements the same defineStore contract (types imported type-only from
 * the real packages, so the compile-time contract stays authoritative) with a
 * shallow-copy engine — sufficient for the flat geometry state this plugin
 * declares. vitest aliases '@deepseek-ai/dsh-client-runtime/client' to this
 * module; production bundles never see it.
 */

import type {
  EngineStoreHandle, EngineStoreInstance, SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ActionsDecl, StoreSpec } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Declare a store: initial state plus the draft-mutating action table.
 * Implements the engine's persist contract: a named localStorage entry
 * hydrated at create and rewritten on every update (mirrors the published
 * engine; tests get real persistence round-trips).
 * @param spec - initial-state factory, optional persist key, and actions.
 * @returns a handle whose create() builds live instances.
 */
export function defineStore<T, A extends ActionsDecl<T>>(spec: StoreSpec<T, A>): EngineStoreHandle<T, A> {
  return {
    spec,
    create: (): EngineStoreInstance<T, A> => {
      let state: T = spec.init()
      const listeners = new Set<() => void>()
      // Persisted instances start from the stored snapshot when it parses;
      // junk or missing entries fall back to the fresh init (the engine's
      // own corruption stance).
      if (spec.persist !== undefined && globalThis.localStorage !== undefined) {
        const raw = globalThis.localStorage.getItem(spec.persist)
        if (raw !== null) {
          try {
            state = JSON.parse(raw) as T
          } catch {
            // Corrupt persisted entry: start fresh; the next update rewrites it.
          }
        }
      }
      const persist = (): void => {
        if (spec.persist !== undefined && globalThis.localStorage !== undefined) {
          globalThis.localStorage.setItem(spec.persist, JSON.stringify(state))
        }
      }
      const publish = (): void => {
        for (const listener of [...listeners]) listener()
      }
      const store: SnapshotStore<T> = {
        getSnapshot: () => state,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        update: (mutator) => {
          // Shallow copy is exact for the flat geometry state; a nested
          // draft would need a structural copy here.
          const draft = { ...state }
          mutator(draft as T)
          state = draft
          persist()
          publish()
        },
        set: (next) => {
          state = next
          persist()
          publish()
        },
      }
      const actions = {} as Record<string, (...args: never[]) => void>
      for (const [key, fn] of Object.entries(spec.actions)) {
        actions[key] = (...args: never[]): void => {
          store.update((draft) => { (fn as (d: T, ...params: never[]) => void)(draft, ...args) })
        }
      }
      return {
        actions: actions as EngineStoreInstance<T, A>['actions'],
        getSnapshot: () => state,
        subscribe: store.subscribe,
        clearPersisted: () => {
          if (spec.persist !== undefined && globalThis.localStorage !== undefined) {
            globalThis.localStorage.removeItem(spec.persist)
          }
        },
        store,
      }
    },
  }
}
