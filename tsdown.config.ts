/**
 * Build config: the node half is a plain ESM library (tsc emits lib/index.js
 * plus declarations); the browser half is a closure-factory client bundle that
 * hands itself to the loader module table exactly like dsh's own client
 * packages (window.__ModuleLoader__.load({ id, factory })), resolving shared
 * runtime modules through the injected require.
 */
import { defineConfig } from 'tsdown'

/**
 * Specifiers the browser module table answers: the platform seed entries the
 * web shell shares into the frozen module table, plus the client-runtime
 * immediate row (the documented store-exemption every UI package rides).
 * Everything else under @deepseek-ai/* either carries no shared runtime
 * identity (inlined) or is a cross-plugin value import, which must never
 * reach a client bundle — collaborate through cordis services instead.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

export default defineConfig([
  {
    name: 'dsh-code-workbench (node half)',
    entry: { index: 'src/host/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    // Keep the .js extension the package manifest names (tsdown's default
    // ESM naming would emit index.mjs).
    fixedExtension: false,
    clean: true,
  },
  {
    name: 'dsh-code-workbench/client',
    entry: { client: 'src/client/index.ts' },
    // Browser bundle lands next to the node half; clean stays off so the
    // node-half output above survives.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    // Only the module-table entries may stay external — anything else (clsx,
    // inline-safe layers) must inline, or the loader require throws at boot.
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (id: string) => !new Set<string>(CLIENT_EXTERNALS).has(id),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-code-workbench", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
