/**
 * File icon helper for the file explorer tree.
 * Maps file extensions and special names to corresponding VS Code-style
 * icons and CSS classes (colors provided via tokens and stylesheet).
 */

import { IconFolder, IconFolderOpened, IconFile, IconFileCode, IconFileMedia } from '../../theme/codicons.tsx'

export interface FileIconProps {
  readonly name?: string
  readonly path?: string
  readonly isDirectory: boolean
  readonly expanded?: boolean
  readonly size?: number
}

export function FileIcon({ name, path, isDirectory, expanded }: FileIconProps) {
  if (isDirectory) {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-folder" data-file-icon="folder">
        {expanded ? <IconFolderOpened size={16} /> : <IconFolder size={16} />}
      </span>
    )
  }

  const filename = name ?? path ?? ''
  const lower = filename.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''

  // Python
  if (ext === '.py' || ext === '.pyw' || ext === '.ipynb') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-python" title="Python" data-file-icon="python">
        <IconFileCode size={16} />
      </span>
    )
  }

  // Java
  if (ext === '.java' || ext === '.jar' || ext === '.class' || ext === '.jsp') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-java" title="Java" data-file-icon="java">
        <IconFileCode size={16} />
      </span>
    )
  }

  // TypeScript / React
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-typescript" title="TypeScript" data-file-icon="typescript">
        <IconFileCode size={16} />
      </span>
    )
  }

  // JavaScript
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-javascript" title="JavaScript" data-file-icon="javascript">
        <IconFileCode size={16} />
      </span>
    )
  }

  // HTML
  if (ext === '.html' || ext === '.htm') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-html" title="HTML" data-file-icon="html">
        <IconFileCode size={16} />
      </span>
    )
  }

  // CSS / SCSS / LESS
  if (ext === '.css' || ext === '.scss' || ext === '.less' || ext === '.sass') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-css" title="CSS" data-file-icon="css">
        <IconFileCode size={16} />
      </span>
    )
  }

  // JSON
  if (ext === '.json' || ext === '.jsonc' || ext === '.json5') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-json" title="JSON" data-file-icon="json">
        <IconFileCode size={16} />
      </span>
    )
  }

  // YAML / TOML
  if (ext === '.yml' || ext === '.yaml' || ext === '.toml') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-yaml" title="YAML" data-file-icon="yaml">
        <IconFileCode size={16} />
      </span>
    )
  }

  // Markdown / Docs
  if (ext === '.md' || ext === '.markdown' || ext === '.mdown' || ext === '.doc' || ext === '.docx' || ext === '.pdf') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-markdown" title="Document" data-file-icon="markdown">
        <IconFile size={16} />
      </span>
    )
  }

  // Shell / PowerShell / Bat
  if (ext === '.sh' || ext === '.bash' || ext === '.zsh' || ext === '.ps1' || ext === '.bat' || ext === '.cmd') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-shell" title="Shell Script" data-file-icon="shell">
        <IconFileCode size={16} />
      </span>
    )
  }

  // C / C++ / C#
  if (ext === '.c' || ext === '.cpp' || ext === '.cc' || ext === '.cxx' || ext === '.h' || ext === '.hpp' || ext === '.cs') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-cpp" title="C/C++" data-file-icon="cpp">
        <IconFileCode size={16} />
      </span>
    )
  }

  // Rust
  if (ext === '.rs') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-rust" title="Rust" data-file-icon="rust">
        <IconFileCode size={16} />
      </span>
    )
  }

  // Go
  if (ext === '.go') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-go" title="Go" data-file-icon="go">
        <IconFileCode size={16} />
      </span>
    )
  }

  // Images
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.svg' || ext === '.webp' || ext === '.ico' || ext === '.bmp') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-image" title="Image" data-file-icon="image">
        <IconFileMedia size={16} />
      </span>
    )
  }

  // Git / Config / Lock
  if (lower.startsWith('.git') || lower.startsWith('.env') || lower === 'dockerfile' || lower.includes('lock') || ext === '.ini' || ext === '.cfg') {
    return (
      <span className="dsh-wb-fileicon dsh-wb-fileicon-config" title="Config" data-file-icon="config">
        <IconFile size={16} />
      </span>
    )
  }

  // Default File
  return (
    <span className="dsh-wb-fileicon dsh-wb-fileicon-default" data-file-icon="default">
      <IconFile size={16} />
    </span>
  )
}
