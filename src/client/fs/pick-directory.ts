/**
 * Direct RPC helper for invoking the Host native directory picker dialog.
 * Issues a POST to /api/host.pickDirectory and resolves with the chosen path
 * (or null on cancellation).
 */

export async function pickNativeDirectory(): Promise<string | null> {
  const rpcId = Math.random().toString(36).slice(2)
  const response = await fetch('/api/host.pickDirectory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId,
      method: 'host.pickDirectory',
      payload: {},
    }),
  })
  if (!response.ok) {
    throw new Error(`Directory picker request failed: HTTP ${response.status}`)
  }
  const data = await response.json() as {
    type?: string
    result?: { ok: true; value: { path: string | null } } | { ok: false; error: { message: string } }
  }
  if (data?.result?.ok === true) {
    return data.result.value.path
  }
  if (data?.result?.ok === false) {
    throw new Error(data.result.error.message)
  }
  throw new Error('Malformed response from /api/host.pickDirectory')
}
