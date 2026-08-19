import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // The published client-runtime `./client` export is a browser
      // closure-factory bundle; tests load the type-compatible engine stub
      // instead (see src/client/testing/runtime-stub.ts). Production bundles
      // resolve the real package — this alias is test-only.
      '@deepseek-ai/dsh-client-runtime/client': fileURLToPath(
        new URL('./src/client/testing/runtime-stub.ts', import.meta.url),
      ),
      // The published primitives package pulls stylesheet-bearing deps (katex)
      // that Node cannot resolve; the stub keeps tests icon-compatible.
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(
        new URL('./src/client/testing/ui-primitives-stub.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    globals: true,
    // External packages (ui-primitives and friends) may import css; stub the
    // imports instead of resolving them.
    css: false,
    setupFiles: ['./src/client/testing/matchmedia-setup.ts'],
  },
})
