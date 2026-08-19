import { describe, expect, it } from 'vitest'
import { createEditorStore } from './editor-store.ts'
import type { EditorGroup, EditorTab } from './editor-store.ts'

function tab(path: string, content = '', version: string | undefined = undefined): EditorTab {
  return { path, content, version, dirty: false }
}

/** The group currently focused. */
function activeGroup(s: ReturnType<ReturnType<typeof createEditorStore>['create']>): EditorGroup {
  const state = s.getSnapshot()
  const group = state.groups.find(candidate => candidate.id === state.activeGroupId)
  if (group === undefined) throw new Error('activeGroupId does not reference a live group')
  return group
}

/** All tab paths across every group. */
function allPaths(s: ReturnType<ReturnType<typeof createEditorStore>['create']>): string[] {
  return s.getSnapshot().groups.flatMap(group => group.tabs.map(t => t.path))
}

describe('editor store: groups and tabs', () => {
  it('boots with a single empty group', () => {
    const s = createEditorStore().create()
    const state = s.getSnapshot()
    expect(state.groups).toHaveLength(1)
    expect(state.activeGroupId).toBe(state.groups[0]!.id)
    expect(state.splitDirection).toBeUndefined()
    expect(state.splitRatio).toBe(50)
  })

  it('opens a tab into the active group and activates it', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts', 'let a = 1', 'v1'))
    expect(activeGroup(s).tabs.map(t => t.path)).toEqual(['/w/a.ts'])
    expect(activeGroup(s).activePath).toBe('/w/a.ts')
  })

  it('re-opening an open path focuses it instead of duplicating or overwriting', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts', 'old', 'v1'))
    s.actions.setContent('/w/a.ts', 'unsaved edit')
    s.actions.openTab(tab('/w/a.ts', 'new', 'v2'))
    expect(allPaths(s)).toEqual(['/w/a.ts'])
    expect(activeGroup(s).tabs[0]).toMatchObject({ content: 'unsaved edit', dirty: true })
  })

  it('marks content edits dirty and clears dirty on save', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts', 'a', 'v1'))
    s.actions.setContent('/w/a.ts', 'b')
    expect(activeGroup(s).tabs[0]).toMatchObject({ content: 'b', dirty: true })
    s.actions.markSaved('/w/a.ts', 'v2')
    expect(activeGroup(s).tabs[0]).toMatchObject({ version: 'v2', dirty: false })
  })

  it('closes the active tab preferring the next, then the previous', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.openTab(tab('/w/b.ts'))
    s.actions.openTab(tab('/w/c.ts'))
    s.actions.activate('/w/b.ts')
    s.actions.closeTab('/w/b.ts')
    expect(activeGroup(s).activePath).toBe('/w/c.ts')
    s.actions.closeTab('/w/c.ts')
    expect(activeGroup(s).activePath).toBe('/w/a.ts')
    s.actions.closeTab('/w/a.ts')
    expect(activeGroup(s).activePath).toBeUndefined()
  })

  it('ignores activation of an unknown path', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.activate('/w/nope.ts')
    expect(activeGroup(s).activePath).toBe('/w/a.ts')
  })
})

describe('editor store: splits and moves', () => {
  it('split adds a fresh empty group and focuses it', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.split('horizontal')
    const state = s.getSnapshot()
    expect(state.groups).toHaveLength(2)
    expect(state.splitDirection).toBe('horizontal')
    expect(state.splitRatio).toBe(50)
    expect(activeGroup(s).tabs).toEqual([])
  })

  it('a second split of a two-group editor flips the direction instead of adding a group', () => {
    const s = createEditorStore().create()
    s.actions.split('horizontal')
    s.actions.split('vertical')
    const state = s.getSnapshot()
    expect(state.groups).toHaveLength(2)
    expect(state.splitDirection).toBe('vertical')
  })

  it('opening a path held by another group focuses that group', () => {
    const s = createEditorStore().create()
    const state0 = s.getSnapshot()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.split('horizontal')
    const secondId = s.getSnapshot().activeGroupId
    s.actions.openTab(tab('/w/b.ts'))
    // b.ts lives in the second group; focusing a.ts must re-focus the first.
    s.actions.openTab(tab('/w/a.ts'))
    const state = s.getSnapshot()
    expect(state.activeGroupId).toBe(state0.groups[0]!.id)
    expect(activeGroup(s).activePath).toBe('/w/a.ts')
    expect(secondId).not.toBe(state.activeGroupId)
  })

  it('activate() focuses the group holding the path', () => {
    const s = createEditorStore().create()
    const firstId = s.getSnapshot().groups[0]!.id
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.split('horizontal')
    s.actions.openTab(tab('/w/b.ts'))
    s.actions.activate('/w/a.ts')
    expect(s.getSnapshot().activeGroupId).toBe(firstId)
  })

  it('moveTab relocates a tab between groups and focuses the target', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    const firstId = s.getSnapshot().groups[0]!.id
    s.actions.split('horizontal')
    const secondId = s.getSnapshot().activeGroupId
    s.actions.moveTab('/w/a.ts', secondId)
    const state = s.getSnapshot()
    expect(state.groups.find(g => g.id === firstId)?.tabs).toEqual([])
    expect(state.groups.find(g => g.id === secondId)?.activePath).toBe('/w/a.ts')
    expect(state.activeGroupId).toBe(secondId)
  })

  it('moveTab is a no-op for unknown paths or unknown groups', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    const before = s.getSnapshot()
    s.actions.moveTab('/w/nope.ts', before.groups[0]!.id)
    s.actions.moveTab('/w/a.ts', 'group-missing')
    const after = s.getSnapshot()
    expect(after.groups[0]!.tabs).toEqual(before.groups[0]!.tabs)
    expect(after.activeGroupId).toBe(before.activeGroupId)
  })

  it('closeActiveGroup merges back to a single group and resets split facts', () => {
    const s = createEditorStore().create()
    const firstId = s.getSnapshot().groups[0]!.id
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.split('horizontal')
    s.actions.openTab(tab('/w/b.ts'))
    s.actions.closeActiveGroup()
    const state = s.getSnapshot()
    expect(state.groups).toHaveLength(1)
    expect(state.groups[0]!.id).toBe(firstId)
    expect(state.activeGroupId).toBe(firstId)
    expect(state.splitDirection).toBeUndefined()
    expect(state.splitRatio).toBe(50)
  })

  it('closeActiveGroup is a no-op on a single group', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.closeActiveGroup()
    expect(s.getSnapshot().groups).toHaveLength(1)
    expect(activeGroup(s).activePath).toBe('/w/a.ts')
  })

  it('activateGroup ignores unknown ids', () => {
    const s = createEditorStore().create()
    const original = s.getSnapshot().activeGroupId
    s.actions.activateGroup('group-missing')
    expect(s.getSnapshot().activeGroupId).toBe(original)
  })

  it('setSplitRatio clamps to 0–100', () => {
    const s = createEditorStore().create()
    s.actions.setSplitRatio(-40)
    expect(s.getSnapshot().splitRatio).toBe(0)
    s.actions.setSplitRatio(140)
    expect(s.getSnapshot().splitRatio).toBe(100)
    s.actions.setSplitRatio(62)
    expect(s.getSnapshot().splitRatio).toBe(62)
  })
})

describe('editor store: preview tabs', () => {
  it('replaces the previous clean preview in the same group', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts'))
    s.actions.openTab({ ...tab('/w/prev1.ts'), preview: true })
    s.actions.openTab({ ...tab('/w/prev2.ts'), preview: true })
    expect(activeGroup(s).tabs.map(t => t.path)).toEqual(['/w/a.ts', '/w/prev2.ts'])
  })

  it('never replaces a dirty preview (unsaved edits would be lost)', () => {
    const s = createEditorStore().create()
    s.actions.openTab({ ...tab('/w/prev1.ts'), preview: true })
    s.actions.setContent('/w/prev1.ts', 'edited')
    s.actions.openTab({ ...tab('/w/prev2.ts'), preview: true })
    expect(activeGroup(s).tabs.map(t => t.path)).toEqual(['/w/prev1.ts', '/w/prev2.ts'])
    expect(activeGroup(s).activePath).toBe('/w/prev2.ts')
  })

  it('keeps previews when a non-preview tab opens', () => {
    const s = createEditorStore().create()
    s.actions.openTab({ ...tab('/w/prev.ts'), preview: true })
    s.actions.openTab(tab('/w/pinned.ts'))
    expect(activeGroup(s).tabs.map(t => t.path)).toEqual(['/w/prev.ts', '/w/pinned.ts'])
  })

  it('pinTab converts a preview to a pinned tab', () => {
    const s = createEditorStore().create()
    s.actions.openTab({ ...tab('/w/prev.ts'), preview: true })
    s.actions.pinTab('/w/prev.ts')
    expect(activeGroup(s).tabs[0]?.preview).toBe(false)
  })

  it('reloadContent updates non-dirty tab content and version while preserving dirty: false', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts', 'initial', 'v1'))
    s.actions.reloadContent('/w/a.ts', 'updated from disk', 'v2')
    expect(activeGroup(s).tabs[0]).toMatchObject({ content: 'updated from disk', version: 'v2', dirty: false })
  })

  it('reloadContent does not overwrite a dirty tab', () => {
    const s = createEditorStore().create()
    s.actions.openTab(tab('/w/a.ts', 'initial', 'v1'))
    s.actions.setContent('/w/a.ts', 'user unsaved typing')
    s.actions.reloadContent('/w/a.ts', 'external change', 'v2')
    expect(activeGroup(s).tabs[0]).toMatchObject({ content: 'user unsaved typing', dirty: true })
  })
})
