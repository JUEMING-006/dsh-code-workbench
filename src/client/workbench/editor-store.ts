/**
 * Editor session store: the open-file tabs shared between the file explorer
 * (opens tabs) and the editor area (renders them). Declared with the same
 * defineStore engine as the geometry store; the workbench shell owns one
 * instance and provides it to its regions through React context.
 *
 * The editor is a set of groups. v1 supports one
 * split level: either a single group, or two groups split horizontally
 * (side by side) or vertically (stacked). Tab paths are unique across all
 * groups — opening a path already open in another group focuses that group
 * instead of duplicating the tab.
 */

import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** One open editor tab. */
export interface EditorTab {
  /** Canonical display path (also the tab identity, unique across groups). */
  path: string
  content: string
  /** Provider version token from the last read/save; undefined until first load. */
  version: string | undefined
  /** Whether unsaved edits are pending. */
  dirty: boolean
  /**
   * Preview tabs (unpinned tabs) render italic and are replaced by
   * the next preview opened in the same group — unless they are dirty, since
   * replacing a dirty tab would discard unsaved edits.
   */
  preview?: boolean
  /** Diff view fields. */
  kind?: 'file' | 'diff'
  originalContent?: string
  diffTitle?: string
  /** Explicit language override if selected by user. */
  language?: string
}

/** One editor group: its own tab strip and active tab. */
export interface EditorGroup {
  id: string
  tabs: EditorTab[]
  activePath: string | undefined
}

/** Open-tab state snapshot (one or two groups). */
export interface EditorState {
  groups: EditorGroup[]
  activeGroupId: string
  /**
   * The split direction when two groups exist: horizontal puts them side by
   * side, vertical stacks them. undefined while a single group is open.
   */
  splitDirection: 'horizontal' | 'vertical' | undefined
  /** First group's share of the editor area in percent (0–100, default 50). */
  splitRatio: number
  /**
   * Save-request counter: the Ctrl+S command increments it; the editor area
   * observes the value and saves the active tab (the store stays free of
   * async fs traffic, the editor area owns the save orchestration).
   */
  saveRequestSeq: number
}

/** Draft-mutating actions (peeled by the store engine). */
export type EditorActions = {
  openTab(draft: EditorState, tab: EditorTab): void
  activate(draft: EditorState, path: string): void
  closeTab(draft: EditorState, path: string): void
  setContent(draft: EditorState, path: string, content: string): void
  reloadContent(draft: EditorState, path: string, content: string, version?: string): void
  setLanguage(draft: EditorState, path: string, language: string): void
  markSaved(draft: EditorState, path: string, version: string): void
  split(draft: EditorState, direction: 'horizontal' | 'vertical'): void
  closeActiveGroup(draft: EditorState): void
  moveTab(draft: EditorState, path: string, toGroupId: string): void
  activateGroup(draft: EditorState, groupId: string): void
  setSplitRatio(draft: EditorState, ratio: number): void
  pinTab(draft: EditorState, path: string): void
  requestSave(draft: EditorState): void
  /** Re-home an open tab to a new path (explorer rename); no-op when closed. */
  renamePath(draft: EditorState, from: string, to: string): void
}

/** Group id source; ids need no cross-store coordination, only uniqueness. */
let groupCounter = 0

function nextGroupId(): string {
  groupCounter += 1
  return `group-${groupCounter}`
}

/** Locate the group holding a tab path. */
function groupOf(draft: EditorState, path: string): EditorGroup | undefined {
  return draft.groups.find(group => group.tabs.some(tab => tab.path === path))
}

/** Split the active group: a new empty group takes focus and the new side. */
function splitActive(draft: EditorState, direction: 'horizontal' | 'vertical'): void {
  // v1 keeps one split level: a second split of a two-group editor flips
  // the existing split direction (repeated Ctrl+\ re-splits).
  if (draft.groups.length === 2) {
    draft.splitDirection = direction
    return
  }
  const fresh: EditorGroup = { id: nextGroupId(), tabs: [], activePath: undefined }
  draft.groups = [...draft.groups, fresh]
  draft.activeGroupId = fresh.id
  draft.splitDirection = direction
  draft.splitRatio = 50
}

/** Focus the tab in the group that holds it, if any. */
function activateIn(draft: EditorState, groupId: string, path: string): void {
  draft.activeGroupId = groupId
  const group = draft.groups.find(candidate => candidate.id === groupId)
  if (group !== undefined && group.tabs.some(tab => tab.path === path)) group.activePath = path
}

/** Create the editor store handle (one per workbench shell entry). */
export function createEditorStore(): EngineStoreHandle<EditorState, EditorActions> {
  return defineStore({
    init: (): EditorState => {
      const first: EditorGroup = { id: nextGroupId(), tabs: [], activePath: undefined }
      return { groups: [first], activeGroupId: first.id, splitDirection: undefined, splitRatio: 50, saveRequestSeq: 0 }
    },
    actions: {
      openTab: (d, tab) => {
        // Paths are unique across groups: an already-open tab is focused,
        // not duplicated or overwritten (an unsaved dirty tab must keep its
        // content; reopening the file never discards pending edits).
        const holder = groupOf(d, tab.path)
        if (holder !== undefined) {
          activateIn(d, holder.id, tab.path)
          return
        }
        const target = d.groups.find(group => group.id === d.activeGroupId) ?? d.groups[0]!
        if (tab.preview === true) {
          const replaceable = target.tabs.findIndex(candidate => candidate.preview === true && !candidate.dirty)
          if (replaceable >= 0) target.tabs = target.tabs.filter((_, index) => index !== replaceable)
        }
        target.tabs = [...target.tabs, tab]
        target.activePath = tab.path
      },
      activate: (d, path) => {
        const holder = groupOf(d, path)
        if (holder !== undefined) activateIn(d, holder.id, path)
      },
      closeTab: (d, path) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        const index = holder.tabs.findIndex(tab => tab.path === path)
        holder.tabs = holder.tabs.filter(tab => tab.path !== path)
        if (holder.activePath === path) {
          const next = holder.tabs[index] ?? holder.tabs[index - 1]
          holder.activePath = next?.path
        }
      },
      setContent: (d, path, content) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => tab.path === path ? { ...tab, content, dirty: true } : tab)
      },
      reloadContent: (d, path, content, version) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => {
          if (tab.path !== path) return tab
          if (!tab.dirty) {
            return { ...tab, content, version: version ?? tab.version, dirty: false }
          }
          return tab
        })
      },
      setLanguage: (d, path, language) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => tab.path === path ? { ...tab, language } : tab)
      },
      markSaved: (d, path, version) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => tab.path === path ? { ...tab, version, dirty: false } : tab)
      },
      split: (d, direction) => {
        splitActive(d, direction)
      },
      closeActiveGroup: (d) => {
        if (d.groups.length === 1) return
        const index = d.groups.findIndex(group => group.id === d.activeGroupId)
        const removed = d.groups[index]
        if (removed === undefined) return
        d.groups = d.groups.filter(group => group.id !== removed.id)
        const neighbor = d.groups[index] ?? d.groups[index - 1]
        if (neighbor !== undefined) d.activeGroupId = neighbor.id
        d.splitDirection = undefined
        d.splitRatio = 50
      },
      moveTab: (d, path, toGroupId) => {
        const source = groupOf(d, path)
        const target = d.groups.find(group => group.id === toGroupId)
        if (source === undefined || target === undefined || source.id === target.id) return
        const tab = source.tabs.find(candidate => candidate.path === path)
        if (tab === undefined) return
        source.tabs = source.tabs.filter(candidate => candidate.path !== path)
        if (source.activePath === path) {
          source.activePath = source.tabs[0]?.path
        }
        target.tabs = [...target.tabs, tab]
        activateIn(d, target.id, tab.path)
      },
      activateGroup: (d, groupId) => {
        if (d.groups.some(group => group.id === groupId)) d.activeGroupId = groupId
      },
      setSplitRatio: (d, ratio) => {
        d.splitRatio = Math.min(100, Math.max(0, ratio))
      },
      pinTab: (d, path) => {
        const holder = groupOf(d, path)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => tab.path === path ? { ...tab, preview: false } : tab)
      },
      requestSave: (d) => {
        d.saveRequestSeq += 1
      },
      renamePath: (d, from, to) => {
        const holder = groupOf(d, from)
        if (holder === undefined) return
        holder.tabs = holder.tabs.map(tab => tab.path === from ? { ...tab, path: to } : tab)
        if (holder.activePath === from) holder.activePath = to
      },
    },
  })
}
