// server/src/utils/provider.ts
import { Message } from '../database/models'
import { generateResponse as anthropicGenerate } from './anthropic'
import { generateResponse as geminiGenerate } from './gemini'
import { generateResponse as ollamaGenerate } from './ollama'
import { generateResponse as openaiGenerate } from './openai'

export type ProviderType = 'ollama' | 'gemini' | 'anthropic' | 'openai'

function getProviderModel(provider: ProviderType, model?: string): string {
  switch (provider) {
    case 'ollama':
      return model || 'gpt-oss:20b' // Use ollama model as-is
    case 'gemini':
      return model || 'gemini-2.5-flash' // Respect client-selected Gemini model, default to gemini-2.5-flash
    case 'anthropic':
      return model || 'claude-3-5-sonnet-latest' // Respect client-selected Anthropic model, default to Claude 3.5 Sonnet
    case 'openai':
      return model || 'gpt-4o' // Respect client-selected OpenAI model, default to gpt-4o
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

export async function generateResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  provider: ProviderType,
  model?: string,
  attachments?: Array<{ url?: string; mimeType?: string; filePath?: string }>,
  systemPrompt?: string
): Promise<void> {
  const providerModel = getProviderModel(provider, model)

  // Build a simple textual note for attachments when providers are text-only in our current setup
  const attachmentNote =
    Array.isArray(attachments) && attachments.length > 0
      ? `Attached ${attachments.length} image(s):\n${attachments
          .map((a, idx) => `  ${idx + 1}. ${a.url || '(inline image)'}${a.mimeType ? ` (${a.mimeType})` : ''}`)
          .join('\n')}`
      : ''

  // Prepare messages for AI SDK providers (text-only content objects)
  const aiSdkMessages = messages
    .filter(msg => msg.content && msg.content.trim() !== '')
    .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))

  const aiSdkMessagesWithNote = attachmentNote
    ? [...aiSdkMessages, { role: 'user' as const, content: attachmentNote }]
    : aiSdkMessages

  // Prepend system prompt (for AI SDK providers) if provided
  const aiSdkForOpenAI = systemPrompt
    ? ([{ role: 'system' as const, content: systemPrompt }, ...aiSdkMessagesWithNote] as Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
      }>)
    : (aiSdkMessagesWithNote as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>)

  const aiSdkForGemini = systemPrompt
    ? ([{ role: 'system' as const, content: systemPrompt }, ...aiSdkMessages] as Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
      }>)
    : (aiSdkMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>)

  const aiSdkForAnthropic = aiSdkForGemini

  // Prepare messages for Ollama (expects Message[], but we only use role/content fields)
  const ollamaMessagesWithNote: Message[] = (() => {
    if (!attachmentNote) return messages
    // Clone and append note to the last user message to preserve chronology
    const cloned: any[] = messages.map(m => ({ ...m }))
    for (let i = cloned.length - 1; i >= 0; i--) {
      if (cloned[i].role === 'user') {
        cloned[i].content = `${cloned[i].content}\n\n${attachmentNote}`
        return cloned as Message[]
      }
    }
    // If no user message found, append a synthetic trailing user note
    return [...cloned, { ...cloned[cloned.length - 1], role: 'user', content: attachmentNote }] as any as Message[]
  })()

  switch (provider) {
    case 'ollama':
      return ollamaGenerate(ollamaMessagesWithNote, onChunk, providerModel, systemPrompt)
    case 'gemini': {
      // Forward attachments so Gemini can inline images
      const geminiAttachments = (attachments || []).map(a => ({ mimeType: a.mimeType, filePath: a.filePath }))
      return geminiGenerate(aiSdkForGemini, onChunk, providerModel, geminiAttachments)
    }
    case 'anthropic': {
      // For Anthropic, forward attachments so we can construct image+text content parts
      const anthroAttachments = (attachments || []).map(a => ({
        url: a.url,
        mimeType: a.mimeType,
        filePath: a.filePath,
      }))
      return anthropicGenerate(aiSdkForAnthropic, onChunk, providerModel, anthroAttachments)
    }
    case 'openai':
      return openaiGenerate(aiSdkForOpenAI, onChunk, providerModel)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
