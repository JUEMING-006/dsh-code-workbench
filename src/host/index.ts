/**
 * Host half of the code-workbench plugin: mounts the fs gateway (and, in
 * later phases, the terminal gateway) that exposes host-side capabilities to
 * the workbench UI through the same policy gates the model tools ride.
 */

import type { Context } from '@deepseek-ai/cordis'
import { installActiveFileSection } from './active-file.ts'
import { installFsGateway } from './fs-gateway.ts'
import { installFsOpsGateway } from './fs-ops-gateway.ts'
import { installMonacoStatic } from './monaco-static.ts'
import { installSearchGateway } from './search-gateway.ts'
import { installTerminalGateway } from './terminal-gateway.ts'
import { installReplaceGateway } from './replace-gateway.ts'
import { installGitGateway } from './git-gateway.ts'
import { installCompletionGateway } from './completion-gateway.ts'

/** Required services: the filesystem capability, the web route registry, and the model-facing seams. */
export const inject = ['fs', 'webServer', 'agents', 'systemPrompt']

/**
 * Cordis plugin body.
 * @param ctx - root context carrying fs and webServer.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => installFsGateway(ctx), 'code-workbench: fs gateway route')
  ctx.effect(() => installFsOpsGateway(ctx), 'code-workbench: fs-ops gateway route')
  ctx.effect(() => installSearchGateway(ctx), 'code-workbench: search gateway route')
  ctx.effect(() => installMonacoStatic(ctx), 'code-workbench: monaco static route')
  ctx.effect(() => installTerminalGateway(ctx), 'code-workbench: terminal gateway routes')
  ctx.effect(() => installReplaceGateway(ctx), 'code-workbench: replace gateway route')
  ctx.effect(() => installGitGateway(ctx), 'code-workbench: git gateway route')
  ctx.effect(() => installCompletionGateway(ctx), 'code-workbench: copilot completion gateway route')
  ctx.effect(() => installActiveFileSection(ctx), 'code-workbench: active-file prompt section')
}
