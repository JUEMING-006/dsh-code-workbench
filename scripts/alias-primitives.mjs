// Adds the ui-primitives alias to the vitest config.
import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../vitest.config.ts', import.meta.url)
let s = readFileSync(p, 'utf8').replaceAll('\r\n', '\n')

const from = `      '@deepseek-ai/dsh-client-runtime/client': fileURLToPath(
        new URL('./src/client/testing/runtime-stub.ts', import.meta.url),
      ),
    },`
const to = `      '@deepseek-ai/dsh-client-runtime/client': fileURLToPath(
        new URL('./src/client/testing/runtime-stub.ts', import.meta.url),
      ),
      // The published primitives package pulls stylesheet-bearing deps (katex)
      // that Node cannot resolve; the stub keeps tests icon-compatible.
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(
        new URL('./src/client/testing/ui-primitives-stub.tsx', import.meta.url),
      ),
    },`

if (s.includes(from)) {
  s = s.replace(from, to)
  writeFileSync(p, s)
  console.log('alias added')
} else {
  console.log('miss')
}
