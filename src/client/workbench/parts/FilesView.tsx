/**
 * File explorer: a lazy tree over the fs gateway. Directory children load on
 * first expand and stay cached; files open through the callback the sidebar
 * content wires to the editor store. Right-click opens the explorer context
 * menu — the region resolves the resource and dispatches the command through
 * the shell's runCommand, which owns the prompts, gateways, and tree refresh.
 */

import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useWorkbench } from '../editor-context.ts'
import type { FsClient } from '../../fs/client.ts'
import type { FsEntryView } from '../../../shared/fs-contract.ts'
import type { CommandResource } from '../../platform/commands.ts'
import { ContextMenu } from '../../platform/ContextMenu.tsx'
import { contextMenuEntries } from '../../platform/commands.ts'
import { IconChevronDown, IconChevronRight } from '../../theme/codicons.tsx'
import { FileIcon } from './FileIcon.tsx'

/** Folder-expansion and children-cache state kept in one reducer-friendly shape. */
interface TreeState {
  expanded: ReadonlySet<string>
  childrenByPath: ReadonlyMap<string, readonly FsEntryView[]>
  /** Path of the directory currently loading, if any. */
  loadingPath: string | undefined
  error: string | undefined
}

/** Props for one tree row. */
interface TreeNodeProps {
  readonly fs: FsClient
  readonly path: string
  readonly type: FsEntryView['type']
  readonly depth: number
  readonly activePath: string | undefined
  readonly state: TreeState
  readonly setState: (updater: (prev: TreeState) => TreeState) => void
  readonly onOpenFile: (path: string) => void
  readonly onRowContextMenu: (event: MouseEvent, resource: CommandResource) => void
}

/** VS Code tree indent: one 8px step per depth level. */
const INDENT_STEP = 8
function joinChild(parent: string, name: string): string {
  if (parent.endsWith('/') || parent.endsWith('\\')) {
    return `${parent}${name}`
  }
  const sep = parent.includes('/') && !parent.includes('\\') ? '/' : '\\'
  return `${parent}${sep}${name}`
}

function without(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set)
  next.delete(value)
  return next
}

/** Expand or collapse one directory, loading children on first open. */
function toggleDirectory(
  fs: FsClient,
  path: string,
  state: TreeState,
  setState: (updater: (prev: TreeState) => TreeState) => void,
): void {
  if (state.expanded.has(path)) {
    setState(prev => ({ ...prev, expanded: without(prev.expanded, path) }))
    return
  }
  setState(prev => ({ ...prev, expanded: new Set(prev.expanded).add(path), loadingPath: path, error: undefined }))
  void fs.listDir(path).then(
    (result) => {
      setState(prev => ({
        ...prev,
        childrenByPath: new Map(prev.childrenByPath).set(path, result.entries),
        loadingPath: undefined,
      }))
    },
    (error: unknown) => {
      setState(prev => ({
        ...prev,
        loadingPath: undefined,
        error: error instanceof Error ? error.message : String(error),
      }))
    },
  )
}

/** One tree row: a file leaf or an expandable directory. */
function TreeNode({ fs, path, type, depth, activePath, state, setState, onOpenFile, onRowContextMenu }: TreeNodeProps) {
  const name = path.split(/[/\\]/u).filter(Boolean).pop() ?? path
  const expanded = state.expanded.has(path)
  const children = state.childrenByPath.get(path)
  const isDirectory = type === 'directory'
  return (
    <div>
      <button
        type="button"
        className="dsh-wb-treerow"
        style={{ paddingLeft: 8 + depth * INDENT_STEP }}
        aria-selected={path === activePath}
        onClick={() => {
          if (isDirectory) toggleDirectory(fs, path, state, setState)
          else onOpenFile(path)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRowContextMenu(event, { path, isDirectory })
        }}
        data-file-row={path}
      >
        <span className="dsh-wb-treetwistie">
          {isDirectory
            ? (expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />)
            : null}
        </span>
        <FileIcon name={name} isDirectory={isDirectory} expanded={expanded} />
        <span>{name}</span>
      </button>
      {isDirectory && expanded && children !== undefined && children.map(child => (
        <TreeNode
          key={child.name}
          fs={fs}
          path={joinChild(path, child.name)}
          type={child.type}
          depth={depth + 1}
          activePath={activePath}
          state={state}
          setState={setState}
          onOpenFile={onOpenFile}
          onRowContextMenu={onRowContextMenu}
        />
      ))}
    </div>
  )
}

/** The explorer root: one workspace cwd tree. */
export function FilesView({ fs, root, activePath, onOpenFile }: {
  fs: FsClient
  root: string
  activePath?: string | undefined
  onOpenFile: (path: string) => void
}) {
  const { runCommand } = useWorkbench()
  const [state, setState] = useState<TreeState>(() => ({
    expanded: new Set([root]),
    childrenByPath: new Map(),
    loadingPath: root,
    error: undefined,
  }))
  const [mountedRoot, setMountedRoot] = useState(root)
  // The context menu state: pointer plus the resource it was opened on.
  const [menu, setMenu] = useState<{ x: number; y: number; resource: CommandResource } | undefined>()
  // A changed root (workspace switch) resets the tree.
  if (mountedRoot !== root) {
    setMountedRoot(root)
    setState({ expanded: new Set([root]), childrenByPath: new Map(), loadingPath: root, error: undefined })
  }
  useEffect(() => {
    void fs.listDir(root).then(
      (result) => {
        setState(prev => ({
          ...prev,
          childrenByPath: new Map(prev.childrenByPath).set(root, result.entries),
          loadingPath: undefined,
        }))
      },
      (error: unknown) => {
        setState(prev => ({
          ...prev,
          loadingPath: undefined,
          error: error instanceof Error ? error.message : String(error),
        }))
      },
    )
  }, [fs, root])

  const openMenu = (event: MouseEvent, resource: CommandResource): void => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, resource })
  }

  const isRootExpanded = state.expanded.has(root)
  const rootLabel = root.split(/[/\\]/u).filter(Boolean).pop()?.toUpperCase() ?? root
  const children = state.childrenByPath.get(root)

  return (
    <div
      className="dsh-wb-tree"
      onContextMenu={(event) => { openMenu(event, { path: root, isDirectory: true }) }}
    >
      <div
        className="dsh-wb-tree-rootlabel"
        onClick={() => {
          if (isRootExpanded) {
            setState(prev => ({ ...prev, expanded: without(prev.expanded, root) }))
          } else {
            setState(prev => ({ ...prev, expanded: new Set(prev.expanded).add(root) }))
          }
        }}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none' }}
        title={root}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isRootExpanded) {
              setState(prev => ({ ...prev, expanded: without(prev.expanded, root) }))
            } else {
              setState(prev => ({ ...prev, expanded: new Set(prev.expanded).add(root) }))
            }
          }
        }}
        data-tree-root-header
      >
        <span className="dsh-wb-treetwistie">
          {isRootExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </span>
        <FileIcon name={rootLabel} isDirectory={true} expanded={isRootExpanded} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
          {root}
        </span>
      </div>
      {state.loadingPath !== undefined && <div className="dsh-wb-placeholder">Loading…</div>}
      {state.error !== undefined && (
        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="dsh-wb-error" style={{ fontSize: '12px' }}>{state.error}</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            未找到该工作区目录，请重新选择有效项目：
          </div>
          <button
            type="button"
            className="dsh-wb-button dsh-wb-button-primary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => { runCommand?.('workbench.action.files.openFolder') }}
          >
            打开文件夹 (选择项目)
          </button>
        </div>
      )}
      {isRootExpanded && children !== undefined && children.map(child => (
        <TreeNode
          key={child.name}
          fs={fs}
          path={joinChild(root, child.name)}
          type={child.type}
          depth={0}
          activePath={activePath}
          state={state}
          setState={setState}
          onOpenFile={onOpenFile}
          onRowContextMenu={(event, resource) => { openMenu(event, resource) }}
        />
      ))}
      {menu !== undefined && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={contextMenuEntries('explorer/context')}
          onRun={(commandId) => { runCommand?.(commandId, menu.resource) }}
          onClose={() => { setMenu(undefined) }}
        />
      )}
    </div>
  )
}
