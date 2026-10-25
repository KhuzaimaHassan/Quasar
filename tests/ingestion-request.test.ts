import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { requestIngestion } from '@/lib/ingestion-request'
import { readHttpError } from '@/lib/http-error'

test('ingestion forwards the document once and aborts a stalled service', async () => {
  const requests: { path: string | undefined; secret: string | string[] | undefined; body: string }[] = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, secret: req.headers['x-internal-secret'], body })
    if (JSON.parse(body).document_id === 'stalled') return
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'processing' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/`
  try {
    const response = await requestIngestion(url, 'synthetic-secret', 'document', 2000)
    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { status: 'processing' })
    await assert.rejects(requestIngestion(url, 'synthetic-secret', 'stalled', 100), { name: 'TimeoutError' })
    assert.deepEqual(requests, [
      { path: '/ingest', secret: 'synthetic-secret', body: '{"document_id":"document"}' },
      { path: '/ingest', secret: 'synthetic-secret', body: '{"document_id":"stalled"}' },
    ])
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('upload errors handle platform text, malformed JSON, and application JSON', async () => {
  assert.match(await readHttpError(new Response('An error occurred FUNCTION_INVOCATION_TIMEOUT', { status: 504 }), 'fallback'), /too long/)
  assert.equal(await readHttpError(new Response('<html>private diagnostic</html>', { status: 502 }), 'Safe fallback'), 'Safe fallback')
  assert.equal(await readHttpError(Response.json({ message: 'Document not found' }, { status: 404 }), 'fallback'), 'Document not found')
  assert.equal(await readHttpError(Response.json(null, { status: 500 }), 'Safe fallback'), 'Safe fallback')
})
