import { Message as PrismaMessage } from '@prisma/client'

export function getMessageText(message: any): string {
  if (typeof message.content === 'string' && message.content.length > 0) {
    return message.content
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part: any) => {
        if (part.type === 'text') return part.text
        return '' 
      })
      .join('')
  }
  return ''
}

export function toInitialMessages(dbMessages: PrismaMessage[]): any[] {
  return dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system' | 'data',
    content: msg.content,
  }))
}

export async function convertToModelMessages(messages: any[]): Promise<any[]> {
  return messages
    .filter(m => ['system', 'user', 'assistant', 'tool'].includes(m.role))
    .filter(m => {
      if (typeof m.content === 'string') return m.content.trim().length > 0;
      if (Array.isArray(m.content)) return m.content.length > 0;
      return false;
    })
    .map(m => ({
      role: m.role as 'system' | 'user' | 'assistant' | 'tool',
      content: m.content
    }));
}
