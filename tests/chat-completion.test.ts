import assert from 'node:assert/strict'
import { test } from 'node:test'
import { streamText } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { classifyCompletion, createReplyRecorder, readCompletion, type SavedReply } from '@/lib/chat-completion'
import { buildChatInstructions } from '@/lib/chat-instructions'

test('only a confirmed stop is complete; limits, safety, errors and unknown finishes remain explicit', () => {
  assert.equal(classifyCompletion('stop').status, 'complete')
  for (const reason of ['length', 'content-filter', 'error', 'aborted', 'timeout', 'other', 'tool-calls', 'toString', '__proto__']) {
    assert.equal(classifyCompletion(reason).status, 'incomplete')
    assert.equal(typeof classifyCompletion(reason).message, 'string')
  }
  assert.equal(readCompletion({}), undefined) // historical responses have unknown completion
  assert.equal(readCompletion({ completion: null }), undefined)
  assert.equal(readCompletion({ completion: { finishReason: 10 } }), undefined)
  assert.doesNotMatch(readCompletion({ completion: { finishReason: 'length', message: 'unsafe provider detail' } })!.message!, /unsafe/)
})

test('current-events instructions include a server date and do not promise live search', () => {
  const prompt = buildChatInstructions(new Date('2026-11-16T23:59:59Z'))
  assert.match(prompt, /Current date \(UTC\): 2026-11-16/)
  assert.match(prompt, /no live web search/)
  assert.match(prompt, /cannot verify the latest/)
  assert.match(prompt, /not proof.*remain current/)
})

function harness(timedOut = false) {
  const saved: SavedReply[] = []
  const failures: string[] = []
  const recorder = createReplyRecorder({
    modelLabel: 'QA model', timedOut: () => timedOut,
    saveReply: async reply => { saved.push(reply) },
    recordFailure: async message => { failures.push(message) },
  })
  return { saved, failures, recorder }
}

function parts(reason: 'stop' | 'length' | 'content-filter'): LanguageModelV4StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'answer' },
    { type: 'text-delta', id: 'answer', delta: 'Preserved partial answer' },
    { type: 'text-end', id: 'answer' },
    { type: 'finish', finishReason: { unified: reason, raw: reason }, usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    } },
  ]
}

for (const reason of ['stop', 'length', 'content-filter'] as const) {
  test(`real SDK callbacks persist ${reason} text and completion metadata once`, async () => {
    const { recorder, saved, failures } = harness()
    const model = new MockLanguageModelV4({ doStream: {
      stream: new ReadableStream({ start(controller) { parts(reason).forEach(part => controller.enqueue(part)); controller.close() } }),
    } })
    const result = streamText({ model, prompt: 'Synthetic test', maxRetries: 0, ...recorder })
    await result.consumeStream()
    assert.equal(saved.length, 1)
    assert.equal(saved[0].text, 'Preserved partial answer')
    assert.equal(saved[0].tokenCount, 15)
    assert.equal(saved[0].tokenUsageAvailable, true)
    assert.equal(saved[0].completion.finishReason, reason)
    assert.equal(saved[0].completion.status, reason === 'stop' ? 'complete' : 'incomplete')
    assert.deepEqual(failures, [])
    assert.equal(model.doStreamCalls.length, 1)
  })
}

test('real SDK partial stream error retains text instead of only saving an orphan error', async () => {
  const { recorder, saved } = harness()
  const model = new MockLanguageModelV4({ doStream: { stream: new ReadableStream({ start(controller) {
    parts('stop').slice(0, 3).forEach(part => controller.enqueue(part))
    controller.enqueue({ type: 'error', error: new Error('private provider details') })
    controller.close()
  } }) } })
  await streamText({ model, prompt: 'Synthetic test', maxRetries: 0, ...recorder }).consumeStream()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].text, 'Preserved partial answer')
  assert.equal(saved[0].completion.finishReason, 'error')
  assert.doesNotMatch(JSON.stringify(saved), /private provider/)
})

for (const timedOut of [false, true]) {
  test(`real SDK abort preserves partial text (${timedOut ? 'timeout' : 'user stop'})`, async () => {
    const { recorder, saved } = harness(timedOut)
    const controller = new AbortController()
    const model = new MockLanguageModelV4({ doStream: { stream: new ReadableStream({ start(output) {
      parts('stop').forEach(part => output.enqueue(part)); output.close()
    } }) } })
    await streamText({ model, prompt: 'Synthetic test', abortSignal: controller.signal, maxRetries: 0, ...recorder,
      onChunk(event) { recorder.onChunk(event); if (event.chunk.type === 'text-delta') controller.abort() },
    }).consumeStream()
    assert.equal(saved.length, 1)
    assert.equal(saved[0].text, 'Preserved partial answer')
    assert.equal(saved[0].completion.finishReason, timedOut ? 'timeout' : 'aborted')
    assert.equal(saved[0].tokenUsageAvailable, false)
  })
}

test('empty failures remain retryable; overlapping callbacks cannot write or charge twice', async () => {
  const empty = harness()
  await empty.recorder.onError({ error: { statusCode: 429 } })
  assert.equal(empty.saved.length, 0)
  assert.match(empty.failures[0], /quota/)
  const { recorder, saved } = harness()
  recorder.onChunk({ chunk: { type: 'text-delta', text: 'Kept' } })
  await Promise.all([
    recorder.onError({ error: new Error('private') }),
    recorder.onAbort(),
    recorder.onFinish({ text: 'Kept', usage: { totalTokens: 100 }, finishReason: 'stop' }),
  ])
  assert.equal(saved.length, 1)
  assert.equal(saved[0].completion.status, 'incomplete')
})
