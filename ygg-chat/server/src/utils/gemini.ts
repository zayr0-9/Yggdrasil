import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import fs from 'fs'
import path from 'path'

export async function generateResponse(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  onChunk: (chunk: string) => void,
  model: string = 'gemini-2.5-flash',
  attachments?: Array<{ mimeType?: string; filePath?: string }>,
  abortSignal?: AbortSignal,
  think: boolean = false
): Promise<void> {
  // Start with simple role/content messages
  let formattedMessages: any[] = messages.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))

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
  let aborted = false
  let result: any
  try {
    result = await streamText({
      model: google(model),
      messages: formattedMessages as any,
      // Enable Gemini "thinking" support per provider guide
      providerOptions: think
        ? {
            google: {
              thinkingConfig: {
                thinkingBudget: 8192,
                includeThoughts: true,
              },
            },
          }
        : undefined,
      // forward aborts from the request or caller
      abortSignal,
      onAbort: () => {
        aborted = true
        console.log('Gemini stream aborted')
      },
    })
  } catch (err: any) {
    if (aborted || err?.name === 'AbortError') {
      return
    }
    throw err
  }

  // Prefer full stream (includes reasoning/text parts) when available
  const fullStream: AsyncIterable<any> | undefined =
    (result && (result.fullStream as AsyncIterable<any>)) || (result && (result.dataStream as AsyncIterable<any>))

  try {
    if (fullStream && typeof (fullStream as any)[Symbol.asyncIterator] === 'function') {
      for await (const part of fullStream) {
        try {
          const t = String((part as any)?.type || '')
          // Extract delta from common fields across providers/versions
          const delta: string =
            (part as any)?.delta ??
            (part as any)?.textDelta ??
            (part as any)?.text ??
            (typeof part === 'string' ? part : '')

          if (!delta) continue

          if (think && t.includes('reasoning')) {
            onChunk(JSON.stringify({ part: 'reasoning', delta }))
          } else if (t.includes('text') || typeof part === 'string') {
            onChunk(JSON.stringify({ part: 'text', delta }))
          }
        } catch {
          // Ignore malformed parts
        }
      }
    } else {
      // Fallback: stream plain text deltas
      const { textStream } = result
      for await (const chunk of textStream as AsyncIterable<string>) {
        onChunk(JSON.stringify({ part: 'text', delta: chunk }))
      }
    }
  } catch (err: any) {
    if (aborted || err?.name === 'AbortError') {
      return
    }
    throw err
  }
}
