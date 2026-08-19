/**
 * Shared wire contract between the workbench browser half and the host fs
 * gateway. Both halves import this module: the browser bundle inlines it, the
 * host half compiles it — one vocabulary, no drift.
 *
 * The gateway is deliberately a small HTTP carrier (JSON over
 * `/api/code-workbench/fs`): dsh's Typert remote face is generated from the
 * dsh repository's own services, which an external plugin cannot extend, so
 * the plugin owns its wire instead.
 */

/** One direct-child listing entry. */
export interface FsEntryView {
  readonly name: string
  readonly type: 'file' | 'directory' | 'symlink' | 'other'
}

/** A resolved text file read: content plus the version guard for later writes. */
export interface FsTextFileView {
  /** Canonical display path (the host's execution-world path). */
  readonly path: string
  readonly content: string
  /** Provider version token; pass it back to writeText to guard staleness. */
  readonly version: string
}

/** One gateway operation. */
export type FsGatewayOp =
  | { readonly op: 'listDir'; readonly path: string }
  | { readonly op: 'readText'; readonly path: string }
  | { readonly op: 'writeText'; readonly path: string; readonly content: string; readonly version?: string }
  | { readonly op: 'noteActiveFile'; readonly path: string; readonly sessionId?: string }
  | { readonly op: 'listAll'; readonly path: string }

/** Operation result values. */
export type FsGatewayValue =
  | { readonly kind: 'listDir'; readonly path: string; readonly entries: readonly FsEntryView[] }
  | { readonly kind: 'readText'; readonly file: FsTextFileView }
  | { readonly kind: 'writeText'; readonly path: string; readonly version: string }
  | { readonly kind: 'noteActiveFile' }
  | { readonly kind: 'listAll'; readonly root: string; readonly files: readonly string[] }

/** Successful gateway response. */
export interface FsGatewaySuccess {
  readonly ok: true
  readonly value: FsGatewayValue
}

/** Failed gateway response. */
export interface FsGatewayFailure {
  readonly ok: false
  /** Stable machine code (FS_NOT_FOUND, FS_STALE_VERSION, policy denial, ...). */
  readonly code: string
  readonly message: string
}

export type FsGatewayResponse = FsGatewaySuccess | FsGatewayFailure

/** URL prefix the host gateway registers and the browser client targets. */
export const FS_ROUTE_PATH = '/api/code-workbench/fs'

/**
 * Structural file ops the fs capability lacks (mkdir/rename/remove). The
 * client names the workspace root explicitly; the host enforces containment
 * against it and runs the same policy chain the model tools ride.
 */
export type FsOpsOp =
  | { readonly op: 'mkdir'; readonly root: string; readonly path: string }
  | { readonly op: 'rename'; readonly root: string; readonly path: string; readonly newPath: string }
  | { readonly op: 'remove'; readonly root: string; readonly path: string }

/** Operation result values. */
export type FsOpsValue =
  | { readonly kind: 'mkdir'; readonly path: string }
  | { readonly kind: 'rename'; readonly path: string; readonly newPath: string }
  | { readonly kind: 'remove'; readonly path: string }

/** Successful fs-ops response. */
export interface FsOpsSuccess {
  readonly ok: true
  readonly value: FsOpsValue
}

/** Failed fs-ops response (same carrier as the fs gateway). */
export interface FsOpsFailure {
  readonly ok: false
  /** Stable machine code: FS_OUTSIDE_ROOT, FS_NOT_FOUND, policy denial, ... */
  readonly code: string
  readonly message: string
}

export type FsOpsResponse = FsOpsSuccess | FsOpsFailure

/** URL path the host fs-ops gateway registers. */
export const FS_OPS_ROUTE_PATH = '/api/code-workbench/fs-ops'

/**
 * One match from the host search gateway: the file path, the 1-based line
 * number of the match, the matching line text, and up to three context lines
 * on each side (when available).
 */
export interface SearchMatchView {
  /** File path that contains the match (root-relative). */
  readonly path: string
  /** 1-based line number of the matching line. */
  readonly line: number
  /** The line text that matched the pattern. */
  readonly text: string
  /** Context lines before the match (may be fewer near the file start). */
  readonly before: readonly string[]
  /** Context lines after the match (may be fewer near the file end). */
  readonly after: readonly string[]
}

/** One search request the client sends to the host. */
export interface SearchRequest {
  readonly pattern: string
  /** Glob filter for file paths; omit for all files. */
  readonly glob?: string | undefined
  /** Workspace root to search inside (host enforces containment). */
  readonly root: string
  /** Match options. */
  readonly caseSensitive?: boolean | undefined
  readonly wholeMatch?: boolean | undefined
  readonly useRegex?: boolean | undefined
}

/** Successful search response. */
export interface SearchSuccess {
  readonly ok: true
  readonly value: {
    readonly kind: 'search'
    readonly root: string
    readonly pattern: string
    readonly matches: readonly SearchMatchView[]
    /** Truncated flag: true when the hit ceiling stopped the walk early. */
    readonly truncated: boolean
  }
}

/** Failed search response. */
export interface SearchFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

export type SearchResponse = SearchSuccess | SearchFailure

/** URL path the host search gateway registers. */
export const SEARCH_ROUTE_PATH = '/api/code-workbench/search'

/**
 * One replace request: target file, the literal text to find, and its
 * replacement. The host reads the current file version, performs a single
 * whole-file string replace, and writes back with the version guard.
 */
export interface ReplaceRequest {
  readonly path: string
  readonly find: string
  readonly replace: string
}

/** Successful replace response. */
export interface ReplaceSuccess {
  readonly ok: true
  readonly value: {
    readonly path: string
    readonly version: string
  }
}

/** Failed replace response. */
export interface ReplaceFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

export type ReplaceResponse = ReplaceSuccess | ReplaceFailure

/** URL path the host replace gateway registers. */
export const REPLACE_ROUTE_PATH = '/api/code-workbench/replace'

/** One inline copilot completion request. */
export interface CopilotCompletionRequest {
  readonly prefix: string
  readonly suffix?: string | undefined
  readonly language?: string | undefined
  readonly path?: string | undefined
}

/** Successful copilot completion response. */
export interface CopilotCompletionSuccess {
  readonly ok: true
  readonly completion: string
}

/** Failed copilot completion response. */
export interface CopilotCompletionFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

export type CopilotCompletionResponse = CopilotCompletionSuccess | CopilotCompletionFailure

/** URL path the host copilot completion gateway registers. */
export const COPILOT_ROUTE_PATH = '/api/code-workbench/copilot/complete'

/** Payload for an inline AI code edit (Cursor-style Ctrl+K). */
export interface InlineEditRequest {
  /** The natural language instruction describing the desired edits. */
  readonly instruction: string
  /** The selected snippet of code being edited. */
  readonly selectedCode: string
  /** Context before the selection. */
  readonly prefix?: string | undefined
  /** Context after the selection. */
  readonly suffix?: string | undefined
  /** Language identifier (e.g. 'python', 'typescript'). */
  readonly language?: string | undefined
  /** File path if open. */
  readonly path?: string | undefined
}

/** Successful inline edit response. */
export interface InlineEditSuccess {
  readonly ok: true
  readonly replacement: string
  readonly explanation?: string | undefined
}

/** Failed inline edit response. */
export interface InlineEditFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

export type InlineEditResponse = InlineEditSuccess | InlineEditFailure

/** URL path the host copilot inline edit gateway registers. */
export const INLINE_EDIT_ROUTE_PATH = '/api/code-workbench/copilot/inline-edit'
