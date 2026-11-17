import { DefaultChatTransport } from 'ai'

/** The ID is transport state, not render state; each new request clears it. */
export function createChatTransport(conversationId: string, fetcher: typeof fetch = fetch) {
  let generationId: string | null = null
  const transport = new DefaultChatTransport({
    api: '/api/chat', headers: { 'x-conversation-id': conversationId },
    fetch: async (input, init) => {
      generationId = null
      const response = await fetcher(input, init)
      generationId = response.headers.get('x-generation-id')
      return response
    },
  })
  return { transport, getGenerationId: () => generationId }
}
