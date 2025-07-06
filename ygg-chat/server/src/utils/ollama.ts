// server/src/utils/ollama.ts
import { Message } from '../database/models'

interface OllamaMessage {
  role: string
  content: string
}

export async function generateResponse(
  messages: Message[],
  model: string = 'gemma3:4b',
  onChunk: (chunk: string) => void
): Promise<void> {
  const ollamaMessages: OllamaMessage[] = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))

  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.message?.content) {
            onChunk(data.message.content)
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
