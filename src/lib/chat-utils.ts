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
      if (typeof m.content === 'string' && m.content.trim().length > 0) return true;
      if (Array.isArray(m.content) && m.content.length > 0) return true;
      if (Array.isArray(m.experimental_attachments) && m.experimental_attachments.length > 0) return true;
      if (Array.isArray(m.parts) && m.parts.length > 0) return true;
      return false;
    })
    .map(m => {
      if (m.role === 'user') {
        // If content is already an array, use it directly
        if (Array.isArray(m.content) && m.content.length > 0) {
          return { role: 'user', content: m.content };
        }

        const contentParts: any[] = [];
        
        // 1. Text part
        if (typeof m.content === 'string' && m.content.trim().length > 0) {
          contentParts.push({ type: 'text', text: m.content });
        } else if (typeof m.content === 'string') {
          contentParts.push({ type: 'text', text: m.content || ' ' });
        }

        // 2. Add experimental_attachments
        if (Array.isArray(m.experimental_attachments)) {
          for (const att of m.experimental_attachments) {
            if (att.contentType?.startsWith('image/')) {
              contentParts.push({ type: 'image', image: new URL(att.url) });
            }
          }
        }

        // 3. Add parts
        if (Array.isArray(m.parts)) {
          for (const part of m.parts) {
            const mediaType = part.mediaType || part.contentType || '';
            if (part.type === 'file' || part.type === 'image') {
              if (mediaType.startsWith('image/')) {
                 contentParts.push({ type: 'image', image: new URL(part.url) });
              }
            }
          }
        }

        return {
          role: 'user',
          content: contentParts.length > 0 ? contentParts : m.content
        };
      }

      return {
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content
      };
    });
}
