/**
 * Shared wire contract between the workbench browser half and the host git
 * gateway over `/api/code-workbench/git`.
 */

export const GIT_ROUTE_PATH = '/api/code-workbench/git'

export type GitFileStatusCode = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?' | '!' | ' '

export interface GitFileChange {
  /** Root-relative path. */
  readonly path: string
  readonly status: GitFileStatusCode
  readonly staged: boolean
  readonly oldPath?: string
}

export type GitOp =
  | { readonly op: 'status'; readonly root: string }
  | { readonly op: 'stage'; readonly root: string; readonly paths: readonly string[] }
  | { readonly op: 'unstage'; readonly root: string; readonly paths: readonly string[] }
  | { readonly op: 'discard'; readonly root: string; readonly paths: readonly string[] }
  | { readonly op: 'commit'; readonly root: string; readonly message: string }
  | { readonly op: 'diff'; readonly root: string; readonly path: string; readonly staged?: boolean }

export type GitValue =
  | {
    readonly kind: 'status'
    readonly isRepo: boolean
    readonly branch?: string
    readonly tracking?: string
    readonly staged: readonly GitFileChange[]
    readonly unstaged: readonly GitFileChange[]
  }
  | { readonly kind: 'stage' }
  | { readonly kind: 'unstage' }
  | { readonly kind: 'discard' }
  | { readonly kind: 'commit'; readonly hash?: string }
  | { readonly kind: 'diff'; readonly original: string; readonly modified: string }

export interface GitSuccess {
  readonly ok: true
  readonly value: GitValue
}

export interface GitFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

export type GitResponse = GitSuccess | GitFailure
