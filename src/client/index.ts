/**
 * Browser half of the code-workbench plugin: the workbench shell and its
 * mode store. Everything here runs only in code mode; harness mode boots
 * this bundle but its apply is a no-op.
 */

export { apply, inject, name } from './apply.ts'
export type {} from './workbench/slots.ts'

export {
  clearSessionMode, DEFAULT_MODE, GLOBAL_MODE_KEY, isShellMode, readGlobalMode, readMode,
  SESSION_MODE_PREFIX, writeMode,
} from './mode/store.ts'
export type { ModeStorage, ShellMode } from './mode/store.ts'
export {
  DEFAULT_GEOMETRY, PANEL_HEIGHT_RANGE, SIDEBAR_WIDTH_RANGE, createWorkbenchStore,
} from './workbench/geometry.ts'
export type { ActivityId, WorkbenchActions, WorkbenchGeometryState } from './workbench/geometry.ts'
export { WorkbenchShell } from './workbench/WorkbenchShell.tsx'
export type { WorkbenchRegionKey, WorkbenchShellProps } from './workbench/WorkbenchShell.tsx'
export { WORKBENCH_CHILDREN } from './workbench/slots.ts'
