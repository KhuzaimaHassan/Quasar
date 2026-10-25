export const BACKEND_REQUEST_TIMEOUT_MS = 150_000

export function postToBackend(
  serviceUrl: string,
  internalSecret: string,
  path: string,
  body: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const deadline = AbortSignal.timeout(options.timeoutMs ?? BACKEND_REQUEST_TIMEOUT_MS)
  return fetch(`${serviceUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
    body: JSON.stringify(body),
    signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline,
  })
}
