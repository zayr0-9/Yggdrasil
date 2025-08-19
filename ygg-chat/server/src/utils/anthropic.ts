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
  // Build Anthropic-compatible messages. Start with simple messages
  let formattedMessages: any[] = messages.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))

  const imageAtts = (attachments || []).filter(a => a.filePath)
  if (imageAtts.length > 0) {
    // Convert ALL messages to structured content parts to satisfy AI SDK validator
    formattedMessages = formattedMessages.map((m: any) => ({
      role: m.role,
      content: [{ type: 'text', text: String(m.content || '') }],
    }))

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
      formattedMessages.push({ role: 'user', content: [{ type: 'text', text: '' }] })
      lastUserIdx = formattedMessages.length - 1
    }

    const parts: any[] = []
    for (const att of imageAtts) {
      try {
        const baseDir = path.resolve(__dirname, '..') // dist root
        let abs = path.isAbsolute(att.filePath!) ? att.filePath! : path.join(baseDir, att.filePath!)
        if (!fs.existsSync(abs)) {
          // Fallbacks: server cwd (e.g., project/server), and dist/src guesses
          const tryCwd = path.resolve(process.cwd(), att.filePath!)
          const tryDist = path.resolve(process.cwd(), 'dist', att.filePath!)
          const trySrc = path.resolve(process.cwd(), 'src', att.filePath!)
          abs = [tryCwd, tryDist, trySrc].find(p => fs.existsSync(p)) || abs
        }
        const buf = fs.readFileSync(abs)
        const mediaType = att.mimeType || 'image/jpeg'
        // Use unified file part (AI SDK will translate to provider-specific format)
        parts.push({ type: 'file', data: buf, mediaType })
      } catch {
        // Ignore failed attachment read
      }
    }
    // Prepend file parts before the existing text part to preserve user text
    const existing = Array.isArray(formattedMessages[lastUserIdx].content)
      ? formattedMessages[lastUserIdx].content
      : [{ type: 'text', text: String(formattedMessages[lastUserIdx].content || '') }]
    formattedMessages[lastUserIdx] = { role: 'user', content: [...parts, ...existing] }
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
