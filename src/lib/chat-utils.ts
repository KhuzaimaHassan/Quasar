import { Message as PrismaMessage } from '@prisma/client'

export function getMessageText(message: any): string {
  if (typeof message.content === 'string' && message.content.length > 0) {
    return message.content
  }
  if (typeof message.text === 'string' && message.text.length > 0) {
    return message.text
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
      const text = getMessageText(m);
      if (text.trim().length > 0) return true;
      if (Array.isArray(m.experimental_attachments) && m.experimental_attachments.length > 0) return true;
      if (Array.isArray(m.parts) && m.parts.length > 0) return true;
      return false;
    })
    .map(m => {
      if (m.role === 'user') {
        const textContent = getMessageText(m);
        const imageParts: any[] = [];

        // 2. Add experimental_attachments
        if (Array.isArray(m.experimental_attachments)) {
          for (const att of m.experimental_attachments) {
            if (att.contentType?.startsWith('image/')) {
              imageParts.push({ type: 'image', image: new URL(att.url) });
            }
          }
        }

        // 3. Add parts
        if (Array.isArray(m.parts)) {
          for (const part of m.parts) {
            const mediaType = part.mediaType || part.contentType || '';
            if (part.type === 'file' || part.type === 'image') {
              if (mediaType.startsWith('image/')) {
                 imageParts.push({ type: 'image', image: new URL(part.url) });
              }
            }
          }
        }

        if (imageParts.length > 0) {
          const textPart = { type: 'text', text: textContent.trim().length > 0 ? textContent : ' ' };
          return {
            role: 'user',
            content: [textPart, ...imageParts]
          };
        }

        return {
          role: 'user',
          content: textContent || ' '
        };
      }

      return {
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: getMessageText(m) || m.content
      };
    });
}
