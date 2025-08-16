import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import fs from 'fs'
import path from 'path'

export async function generateResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string) => void,
  model: string = 'claude-3-5-sonnet-latest',
  attachments?: Array<{ mimeType?: string; filePath?: string }>
): Promise<void> {
  // Build Anthropic-compatible messages. If attachments exist, attach them as image parts to the last user message.
  let formattedMessages: any[] = messages.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))

  const imageAtts = (attachments || []).filter(a => a.filePath)
  if (imageAtts.length > 0) {
    // Find last user message index
    let lastUserIdx = -1
    for (let i = formattedMessages.length - 1; i >= 0; i--) {
      if (formattedMessages[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }

    // If none, append a new user message for attachments
    if (lastUserIdx === -1) {
      formattedMessages.push({ role: 'user', content: '' })
      lastUserIdx = formattedMessages.length - 1
    }

    const originalText: string = String(formattedMessages[lastUserIdx].content || '')

    const parts: any[] = []
    for (const att of imageAtts) {
      try {
        let abs = path.isAbsolute(att.filePath!) ? att.filePath! : path.join(__dirname, att.filePath!)
        if (!fs.existsSync(abs)) {
          // Fallback: resolve relative to process cwd (server root)
          abs = path.resolve(process.cwd(), att.filePath!)
        }
        const buf = fs.readFileSync(abs)
        const b64 = buf.toString('base64')
        const mediaType = att.mimeType || 'image/jpeg'
        parts.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: b64 },
        })
      } catch {
        // Ignore failed attachment read
      }
    }
    if (originalText && originalText.trim().length > 0) {
      parts.push({ type: 'text', text: originalText })
    }
    formattedMessages[lastUserIdx] = { role: 'user', content: parts }
  }

  const { textStream } = await streamText({ model: anthropic(model), messages: formattedMessages as any })
  /*max_tokens, 
  "thinking": {
        "type": "enabled",
        "budget_tokens": 10000
    },
  */
  for await (const chunk of textStream) {
    onChunk(chunk)
  }
}
