/**
 * Lightweight document symbol parser and outline extractor:
 * Parses classes, functions, methods, interfaces, types and markdown headers
 * for breadcrumbs, outline trees, and quick symbol navigation (Ctrl+Shift+O).
 */

export interface DocumentSymbol {
  readonly name: string
  readonly kind: 'function' | 'class' | 'method' | 'interface' | 'variable' | 'heading'
  readonly line: number
  readonly endLine?: number
  readonly containerName?: string
}

/** Extract symbols from document content based on language/path. */
export function extractDocumentSymbols(content: string, languageOrPath: string): DocumentSymbol[] {
  const lines = content.split(/\r?\n/u)
  const symbols: DocumentSymbol[] = []
  const lang = languageOrPath.toLowerCase()

  const isPython = lang.endsWith('.py') || lang.includes('python')
  const isJsTs = lang.endsWith('.ts') || lang.endsWith('.tsx') || lang.endsWith('.js') || lang.endsWith('.jsx') || lang.includes('javascript') || lang.includes('typescript')
  const isRust = lang.endsWith('.rs') || lang.includes('rust')
  const isGo = lang.endsWith('.go') || lang.includes('go')
  const isMd = lang.endsWith('.md') || lang.includes('markdown')

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue
    if (trimmed.startsWith('#') && !isMd) continue

    if (isPython) {
      const match = /^(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/u.exec(trimmed)
      if (match?.[1]) {
        const isMethod = /^\s{2,}/u.test(line)
        symbols.push({
          name: match[1],
          kind: isMethod ? 'method' : 'function',
          line: lineNum,
        })
        continue
      }
      const classMatch = /^class\s+([a-zA-Z_][a-zA-Z0-9_]*)/u.exec(trimmed)
      if (classMatch?.[1]) {
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          line: lineNum,
        })
        continue
      }
    }

    if (isJsTs) {
      const fnMatch = /^(?:export\s+)?(?:async\s+)?function(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(/u.exec(trimmed)
      if (fnMatch?.[1]) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum })
        continue
      }
      const constFnMatch = /^(?:export\s+)?const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/u.exec(trimmed)
      if (constFnMatch?.[1]) {
        symbols.push({ name: constFnMatch[1], kind: 'function', line: lineNum })
        continue
      }
      const classMatch = /^(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/u.exec(trimmed)
      if (classMatch?.[1]) {
        symbols.push({ name: classMatch[1], kind: 'class', line: lineNum })
        continue
      }
      const ifaceMatch = /^(?:export\s+)?(?:interface|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/u.exec(trimmed)
      if (ifaceMatch?.[1]) {
        symbols.push({ name: ifaceMatch[1], kind: 'interface', line: lineNum })
        continue
      }
    }

    if (isRust) {
      const fnMatch = /^(?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/u.exec(trimmed)
      if (fnMatch?.[1]) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum })
        continue
      }
      const structMatch = /^(?:pub(?:\s*\([^)]*\))?\s+)?(?:struct|enum|trait)\s+([a-zA-Z_][a-zA-Z0-9_]*)/u.exec(trimmed)
      if (structMatch?.[1]) {
        symbols.push({ name: structMatch[1], kind: 'class', line: lineNum })
        continue
      }
    }

    if (isGo) {
      const fnMatch = /^func\s+(?:\([^)]*\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/u.exec(trimmed)
      if (fnMatch?.[1]) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum })
        continue
      }
      const typeMatch = /^type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/u.exec(trimmed)
      if (typeMatch?.[1]) {
        symbols.push({ name: typeMatch[1], kind: 'class', line: lineNum })
        continue
      }
    }

    if (isMd && trimmed.startsWith('#')) {
      const headerMatch = /^(#{1,6})\s+(.+)$/u.exec(trimmed)
      if (headerMatch?.[2]) {
        symbols.push({ name: headerMatch[2], kind: 'heading', line: lineNum })
        continue
      }
    }
  }

  return symbols
}

/** Find the innermost symbol enclosing a specific line number. */
export function findEnclosingSymbol(symbols: readonly DocumentSymbol[], line: number): DocumentSymbol | undefined {
  let best: DocumentSymbol | undefined
  for (const sym of symbols) {
    if (sym.line <= line) {
      if (!best || sym.line >= best.line) {
        best = sym
      }
    }
  }
  return best
}

/** Search for the definition of a symbol name in file content. */
export function findSymbolInContent(symbolName: string, content: string, path: string): { line: number; col: number } | undefined {
  if (!symbolName || symbolName.length === 0) return undefined
  const symbols = extractDocumentSymbols(content, path)
  const exact = symbols.find(s => s.name === symbolName)
  if (exact) {
    return { line: exact.line, col: 1 }
  }
  // Also search for variable assignments or definitions (e.g. `symbolName = ` or `let symbolName =`)
  const lines = content.split(/\r?\n/u)
  const varRegex = new RegExp(`^(?:export\\s+)?(?:const|let|var|def|class|function)?\\s*\\b${symbolName}\\b\\s*[:=(]`, 'u')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim()
    if (varRegex.test(trimmed)) {
      return { line: i + 1, col: 1 }
    }
  }
  return undefined
}
