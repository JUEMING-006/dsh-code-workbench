/**
 * Host copilot completion gateway: serves low-latency inline code completions
 * at `POST /api/code-workbench/copilot/complete`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { COPILOT_ROUTE_PATH, INLINE_EDIT_ROUTE_PATH } from '../shared/fs-contract.ts'
import type {
  CopilotCompletionRequest,
  CopilotCompletionResponse,
  InlineEditRequest,
  InlineEditResponse,
} from '../shared/fs-contract.ts'

/** Read a small JSON body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw) as unknown
}

/** Narrow the request body. */
export function parseCopilotRequest(body: unknown): CopilotCompletionRequest {
  if (typeof body !== 'object' || body === null) throw new Error('request body must be a JSON object')
  const candidate = body as Record<string, unknown>
  if (typeof candidate.prefix !== 'string') {
    throw new Error('completion requires a string prefix')
  }
  return {
    prefix: candidate.prefix,
    ...(typeof candidate.suffix === 'string' ? { suffix: candidate.suffix } : {}),
    ...(typeof candidate.language === 'string' ? { language: candidate.language } : {}),
    ...(typeof candidate.path === 'string' ? { path: candidate.path } : {}),
  }
}

/** Respond JSON with the given status. */
function json(res: ServerResponse, status: number, payload: CopilotCompletionResponse | InlineEditResponse): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Resolve effective LLM credentials, base URL and model for completions. */
export function getEffectiveProviderConfig(): { apiKey: string; baseURL: string; model: string } {
  let apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.STEP_API_KEY ?? ''
  let baseURL = process.env.DEEPSEEK_BASE_URL ?? process.env.STEP_BASE_URL ?? ''
  let model = process.env.COPILOT_MODEL ?? ''

  try {
    const homedir = os.homedir()
    const credPath = path.join(homedir, '.dsh', '.credentials.yaml')
    if (fs.existsSync(credPath)) {
      const text = fs.readFileSync(credPath, 'utf8')
      const match = /(?:STEP_API_KEY|DEEPSEEK_API_KEY):\s*([^\r\n]+)/u.exec(text)
      if (match && !apiKey) {
        apiKey = match[1]?.trim() ?? ''
      }
    }
    const settingsPath = path.join(homedir, '.dsh', 'settings.yaml')
    if (fs.existsSync(settingsPath)) {
      const text = fs.readFileSync(settingsPath, 'utf8')
      const baseMatch = /^\s*baseURL:\s*([^\r\n]+)/mu.exec(text)
      if (baseMatch && !baseURL) {
        baseURL = baseMatch[1]?.trim() ?? ''
      }
      const modelMatch = /^\s*model:\s*([^\r\n]+)/mu.exec(text)
      if (modelMatch && !model) {
        model = modelMatch[1]?.trim() ?? ''
      }
    }
  } catch {
    // Ignore fs errors in test environments
  }

  baseURL = baseURL || 'https://api.deepseek.com'
  if (baseURL.includes('stepfun') && (!model || model === 'step-3.5-flash')) {
    model = 'step-3.7-flash'
  }
  model = model || 'deepseek-chat'
  return { apiKey, baseURL, model }
}

/** Clean up markdown code block fences and prefix overlap. */
export function sanitizeCompletionText(raw: string, prefix = ''): string {
  let text = raw.replace(/^```[a-zA-Z]*\r?\n?/u, '').replace(/\r?\n?```$/u, '')
  const trimmedPrefix = prefix.trim()
  const trimmedText = text.trim()
  if (trimmedPrefix.length > 0 && trimmedText.startsWith(trimmedPrefix)) {
    text = trimmedText.slice(trimmedPrefix.length)
  } else if (prefix.length > 0) {
    const lastLine = prefix.split(/\r?\n/u).pop()?.trim() ?? ''
    if (lastLine.length > 0 && text.trim().startsWith(lastLine)) {
      text = text.trim().slice(lastLine.length)
    }
  }
  text = text.replace(/^\r?\n+/u, '')
  return text
}

/** Extract candidate code from markdown fences or raw indentation/keywords. */
export function extractCodeCandidate(text: string): string {
  // 1. Try markdown code block
  const codeBlocks = Array.from(text.matchAll(/```(?:[a-zA-Z]*\r?\n)?([\s\S]+?)```/gu))
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    const block = codeBlocks[i]?.[1]?.trim() ?? ''
    if (block.length > 0 && !/^(?:The |Here |Note |Wait )/ui.test(block)) {
      return block
    }
  }

  // 2. Try raw code block (supports 1 line or more)
  const lines = text.split(/\r?\n/u)
  const currentChunk: string[] = []
  let bestChunk: string[] = []

  for (const line of lines) {
    const isCode =
      /^\s*(?:def |class |if |for |while |try:|except |return |raise |pass\b|const |let |var |function |async |import |from |self\.)/u.test(line) ||
      (/^\s{2,}\S+/u.test(line) && !/^(?:Wait|Let|First|So|Because|The|This|Oh|Looking|Note|I will|We need|In Python)\b/ui.test(line.trim()))

    if (isCode) {
      currentChunk.push(line)
      if (currentChunk.length > bestChunk.length) {
        bestChunk = [...currentChunk]
      }
      if (currentChunk.some(l => l.includes('return') || l.includes('pass') || l.includes('raise'))) {
        return currentChunk.join('\n')
      }
    } else {
      if (currentChunk.length >= 2 && currentChunk.some(l => l.includes('return') || l.includes('pass') || l.includes('raise') || l.includes('='))) {
        return currentChunk.join('\n')
      }
      currentChunk.length = 0
    }
  }

  if (bestChunk.length >= 2) {
    return bestChunk.join('\n')
  }

  return ''
}

async function streamFetchCompletion(
  url: string,
  apiKey: string,
  model: string,
  request: CopilotCompletionRequest,
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => { controller.abort() }, 3000)
  let foundCode = ''

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: 'You are an ultra-fast inline code autocomplete daemon. Return ONLY the code snippet to be inserted directly at cursor position without explanations.',
          },
          {
            role: 'user',
            content: `File: ${request.path ?? 'untitled'}\nLanguage: ${request.language ?? 'plaintext'}\n\n[Code before cursor]:\n${request.prefix.slice(-1000)}\n\n[Code after cursor]:\n${(request.suffix ?? '').slice(0, 500)}\n\n[Code to insert at cursor]:`,
          },
        ],
        max_tokens: 256,
        temperature: 0.1,
      }),
    })

    if (!response.ok || response.body === null) {
      return ''
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let accumulatedContent = ''
    let accumulatedReasoning = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        if (trimmed === 'data: [DONE]') {
          controller.abort()
          break
        }
        const jsonStr = trimmed.slice(5).trim()
        try {
          const json = JSON.parse(jsonStr) as { choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }> }
          const delta = json.choices?.[0]?.delta
          if (delta?.content) {
            accumulatedContent += delta.content
            if (accumulatedContent.split('\n').length >= 2 || accumulatedContent.includes('\n\n')) {
              foundCode = accumulatedContent
              controller.abort()
              break
            }
          }
          if (delta?.reasoning_content) {
            accumulatedReasoning += delta.reasoning_content
            const candidate = extractCodeCandidate(accumulatedReasoning)
            if (candidate.length > 0) {
              foundCode = candidate
              controller.abort()
              break
            }
          }
        } catch {}
      }
      if (foundCode.length > 0) break
    }
  } catch {
    // Abort is expected when code is found
  } finally {
    clearTimeout(timeoutId)
  }

  return foundCode
}

/** Dispatch one completion request to DeepSeek / StepFun. */
export async function dispatchCopilotCompletion(
  _ctx: Context,
  request: CopilotCompletionRequest,
): Promise<CopilotCompletionResponse> {
  if (request.prefix.trim().length === 0) {
    return { ok: true, completion: '' }
  }

  const { apiKey, baseURL, model } = getEffectiveProviderConfig()

  if (!apiKey) {
    return { ok: true, completion: '' }
  }

  try {
    const url = `${baseURL.replace(/\/+$/u, '')}/chat/completions`
    const streamed = await streamFetchCompletion(url, apiKey, model, request)
    return { ok: true, completion: sanitizeCompletionText(streamed, request.prefix) }
  } catch (error) {
    return { ok: false, code: 'FETCH_ERROR', message: error instanceof Error ? error.message : String(error) }
  }
}

/** Validate and normalize an incoming inline edit request. */
export function parseInlineEditRequest(body: unknown): InlineEditRequest {
  if (typeof body !== 'object' || body === null) {
    throw new Error('inline edit request must be an object')
  }
  const rec = body as Record<string, unknown>
  if (typeof rec.instruction !== 'string' || rec.instruction.trim().length === 0) {
    throw new Error('instruction must be a non-empty string')
  }
  if (typeof rec.selectedCode !== 'string') {
    throw new Error('selectedCode must be a string')
  }
  return {
    instruction: rec.instruction.trim(),
    selectedCode: rec.selectedCode,
    prefix: typeof rec.prefix === 'string' ? rec.prefix : undefined,
    suffix: typeof rec.suffix === 'string' ? rec.suffix : undefined,
    language: typeof rec.language === 'string' ? rec.language : undefined,
    path: typeof rec.path === 'string' ? rec.path : undefined,
  }
}

/** Dispatch one inline code edit request to DeepSeek / StepFun (Cursor Ctrl+K). */
export async function dispatchInlineEdit(
  _ctx: Context,
  request: InlineEditRequest,
): Promise<InlineEditResponse> {
  const { apiKey, baseURL, model } = getEffectiveProviderConfig()

  if (!apiKey) {
    return { ok: false, code: 'MISSING_API_KEY', message: 'No API key configured for Copilot/Inline Edit' }
  }

  const systemPrompt = `You are an expert AI code editor (like Cursor Ctrl+K inline edit).
Your task is to rewrite the selected code according to the user's instructions.
CRITICAL RULES:
1. Output ONLY the replacement code for the selected snippet.
2. Do NOT wrap with markdown code blocks or backticks (no \`\`\` or \`\`\`python).
3. Do NOT include conversational text, explanations, or greetings.
4. Strictly maintain matching indentation so the replacement code directly slots into the file.
5. If the user instruction requires keeping part of the code unchanged, preserve it cleanly.`

  const userPrompt = `File: ${request.path ?? 'untitled'}
Language: ${request.language ?? 'plaintext'}

[Context Before Selection]:
${(request.prefix ?? '').slice(-1500)}

[Selected Code to Edit]:
${request.selectedCode}

[Context After Selection]:
${(request.suffix ?? '').slice(0, 1000)}

[User Instruction]:
${request.instruction}

[Replacement Code for Selected Code]:`

  try {
    const url = `${baseURL.replace(/\/+$/u, '')}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return { ok: false, code: 'UPSTREAM_ERROR', message: `API error ${response.status}: ${errText}` }
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }
    let replacement = data.choices?.[0]?.message?.content ?? ''
    if (replacement.trim().length === 0 && data.choices?.[0]?.message?.reasoning_content) {
      replacement = extractCodeCandidate(data.choices[0].message.reasoning_content)
    }

    // Clean up codeblock fences if present
    replacement = replacement.replace(/^```[a-zA-Z]*\r?\n?/u, '').replace(/\r?\n?```$/u, '')

    return { ok: true, replacement }
  } catch (error) {
    return { ok: false, code: 'FETCH_ERROR', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Mount the copilot completion and inline edit gateway routes on the web server.
 * @param ctx - root context carrying webServer.
 * @returns the composite route disposer.
 */
export function installCompletionGateway(ctx: Context): () => void {
  const d1 = ctx.webServer.register({
    kind: 'prefix',
    path: COPILOT_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'copilot completion gateway accepts POST only' })
        return
      }
      let request: CopilotCompletionRequest
      try {
        request = parseCopilotRequest(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        const result = await dispatchCopilotCompletion(ctx, request)
        json(res, result.ok ? 200 : 500, result)
      } catch (error) {
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  const d2 = ctx.webServer.register({
    kind: 'prefix',
    path: INLINE_EDIT_ROUTE_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'inline edit gateway accepts POST only' })
        return
      }
      let request: InlineEditRequest
      try {
        request = parseInlineEditRequest(await readJsonBody(req))
      } catch (error) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: error instanceof Error ? error.message : String(error) })
        return
      }
      try {
        const result = await dispatchInlineEdit(ctx, request)
        json(res, result.ok ? 200 : 500, result)
      } catch (error) {
        json(res, 500, { ok: false, code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  return () => {
    d1()
    d2()
  }
}
