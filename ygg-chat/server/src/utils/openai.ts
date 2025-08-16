import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function generateResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string) => void,
  model: string = 'gpt-4o'
): Promise<void> {
  const formattedMessages = messages.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))
  const { textStream } = await streamText({ model: openai(model), messages: formattedMessages })
  for await (const chunk of textStream) {
    onChunk(chunk)
  }
}
