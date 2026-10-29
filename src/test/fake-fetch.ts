/**
 * Replaces `fetch` for data-layer tests. The generated client (openapi-fetch) captures
 * `globalThis.fetch` when it is created, so a test file must import this module *before* anything
 * that imports `@/api/client` — then every request goes through `respondWith` and is recorded.
 */
export interface RecordedCall {
  method: string
  url: URL
  headers: Headers
  body: unknown
}

type Handler = (call: RecordedCall) => Response | Promise<Response>

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-test' },
  })
}

export const calls: RecordedCall[] = []
let handler: Handler = () => json(200, {})

export function respondWith(next: Handler): void {
  handler = next
}

export function resetFetch(): void {
  calls.length = 0
  handler = () => json(200, {})
}

/** The server's refusal shape (D3.4), for a handler to return. */
export function refusal(status: number, code: string, message: string, fieldErrors = []): Response {
  return json(status, { code, message, traceId: 'trace-test', fieldErrors })
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const text = await request.clone().text()
  const call: RecordedCall = {
    method: request.method,
    url: new URL(request.url),
    headers: request.headers,
    body: text ? JSON.parse(text) : undefined,
  }
  calls.push(call)
  return handler(call)
}) as typeof fetch
