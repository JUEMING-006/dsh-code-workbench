/**
 * Breadcrumbs navigation bar: renders the path hierarchy and active symbol
 * (function/class) below the tab strip, with click-to-navigate.
 */

import { memo } from 'react'
import { FileIcon } from './FileIcon.tsx'
import type { DocumentSymbol } from '../../editor/symbols.ts'
import { IconChevronRight, IconFileCode, IconSparkle } from '../../theme/codicons.tsx'

export interface BreadcrumbsBarProps {
  readonly path: string
  readonly currentSymbol?: DocumentSymbol | undefined
  readonly onSymbolClick?: (symbol: DocumentSymbol) => void
}

export const BreadcrumbsBar = memo(function BreadcrumbsBar({
  path,
  currentSymbol,
  onSymbolClick,
}: BreadcrumbsBarProps) {
  const parts = path.split(/[/\\]/u).filter(Boolean)
  const filename = parts.pop() ?? path

  return (
    <div
      className="dsh-wb-breadcrumbs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 12px',
        fontSize: '11px',
        color: 'var(--dsh-wb-description-foreground)',
        backgroundColor: 'var(--dsh-wb-editor-group-header-tabs-background)',
        borderBottom: '1px solid var(--dsh-wb-tab-border)',
        userSelect: 'none',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
      data-breadcrumbs-bar
    >
      {/* Folder segments */}
      {parts.map((segment, idx) => (
        <span key={`${segment}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ opacity: 0.8 }}>{segment}</span>
          <IconChevronRight size={12} />
        </span>
      ))}

      {/* File segment */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--dsh-wb-foreground)' }}>
        <FileIcon path={filename} isDirectory={false} size={13} />
        <span>{filename}</span>
      </span>

      {/* Symbol segment */}
      {currentSymbol && (
        <>
          <IconChevronRight size={12} />
          <button
            type="button"
            className="dsh-wb-breadcrumb-symbol"
            onClick={() => onSymbolClick?.(currentSymbol)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--dsh-wb-focus-border)',
              padding: '1px 4px',
              borderRadius: '3px',
              cursor: onSymbolClick ? 'pointer' : 'default',
              fontSize: '11px',
            }}
            title={`Jump to ${currentSymbol.name} (Line ${currentSymbol.line})`}
          >
            {currentSymbol.kind === 'class' ? <IconFileCode size={13} /> : <IconSparkle size={13} />}
            <span style={{ fontWeight: 500 }}>{currentSymbol.name}</span>
          </button>
        </>
      )}
    </div>
  )
})
