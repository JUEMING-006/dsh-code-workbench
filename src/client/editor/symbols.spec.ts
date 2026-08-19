import { describe, expect, it } from 'vitest'
import { extractDocumentSymbols, findEnclosingSymbol } from './symbols.ts'

describe('extractDocumentSymbols', () => {
  it('extracts Python functions and classes', () => {
    const code = `
print("start")

class Calculator:
    def add(self, a, b):
        return a + b

def minmax(items):
    return min(items), max(items)
`
    const symbols = extractDocumentSymbols(code, 'main.py')
    expect(symbols).toHaveLength(3)
    expect(symbols[0]).toEqual({ name: 'Calculator', kind: 'class', line: 4 })
    expect(symbols[1]).toEqual({ name: 'add', kind: 'method', line: 5 })
    expect(symbols[2]).toEqual({ name: 'minmax', kind: 'function', line: 8 })

    expect(findEnclosingSymbol(symbols, 6)?.name).toBe('add')
    expect(findEnclosingSymbol(symbols, 9)?.name).toBe('minmax')
    expect(findEnclosingSymbol(symbols, 2)).toBeUndefined()
  })

  it('extracts TypeScript/JavaScript functions, classes, interfaces', () => {
    const code = `
export interface User { id: string }
export class Service {}
export const compute = async () => {}
function helper() {}
`
    const symbols = extractDocumentSymbols(code, 'app.ts')
    expect(symbols).toHaveLength(4)
    expect(symbols.map(s => s.name)).toEqual(['User', 'Service', 'compute', 'helper'])
  })

  it('extracts Markdown headers', () => {
    const code = '# Title\n## Section 1\n### Sub 1'
    const symbols = extractDocumentSymbols(code, 'doc.md')
    expect(symbols).toHaveLength(3)
    expect(symbols[1]?.name).toBe('Section 1')
  })
})
