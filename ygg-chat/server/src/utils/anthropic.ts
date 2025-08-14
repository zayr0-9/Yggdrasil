import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export async function generateResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string) => void,
  model: string = 'claude-3-5-sonnet-latest'
): Promise<void> {
  const formattedMessages = messages.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))
  const { textStream } = await streamText({ model: anthropic(model), messages: formattedMessages })
  for await (const chunk of textStream) {
    onChunk(chunk)
  }
}
