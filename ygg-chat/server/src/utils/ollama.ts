// server/src/utils/ollama.ts
import { Message } from '../database/models'
import { modelService } from './modelService'

interface OllamaMessage {
  role: string
  content: string
}

export async function generateResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  model?: string
): Promise<void> {
  // Use provided model or get default
  const selectedModel = model || (await modelService.getDefaultModel())

  console.log('Using model:', selectedModel)

  const ollamaMessages: OllamaMessage[] = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))

  console.log(
    'Sending to ollama:',
    JSON.stringify({
      model: selectedModel,
      messages: ollamaMessages,
      stream: true,
    })
  )
  //changed from localhost to 172.31.32.1 to run from wsl
  const response = await fetch('http://172.31.32.1:11434/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
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
