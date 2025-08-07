import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { Message } from '../database/models'

export async function generateResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  model: string = 'gemini-2.5-flash'
): Promise<void> {
  const formattedMessages = messages.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))
  /* lots of arguments for streamText
    streamText({ model, tools, toolChoice, system, prompt, messages, maxRetries, abortSignal, headers, stopWhen, 
    experimental_output: output, experimental_telemetry: telemetry, prepareStep, providerOptions, 
    experimental_activeTools, activeTools, experimental_repairToolCall: repairToolCall, 
    experimental_transform: transform, includeRawChunks, onChunk, onError, onFinish, onAbort, 
    onStepFinish, experimental_context, _internal: { now, generateId, currentDate, }, ...settings }:
     CallSettings & Prompt & { model: LanguageModel; tools?: ToolSet | undefined; toolChoice?: ToolChoice<ToolSet> |
     undefined; ... 16 more ...; _internal?: { now?: () => number; generateId?: IdGenerator; currentDate?: () => Date; }
     ; }): StreamTextResult<ToolSet, never>
    */
  const { textStream } = await streamText({ model: google(model), messages: formattedMessages })
  for await (const chunk of textStream) {
    onChunk(chunk)
  }
}
