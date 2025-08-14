// server/src/utils/provider.ts
import { Message } from '../database/models'
import { generateResponse as geminiGenerate } from './gemini'
import { generateResponse as ollamaGenerate } from './ollama'
import { generateResponse as anthropicGenerate } from './anthropic'

export type ProviderType = 'ollama' | 'gemini' | 'anthropic'

function getProviderModel(provider: ProviderType, model?: string): string {
  switch (provider) {
    case 'ollama':
      return model || 'gpt-oss:20b' // Use ollama model as-is
    case 'gemini':
      return model || 'gemini-2.5-flash' // Respect client-selected Gemini model, default to gemini-2.5-flash
    case 'anthropic':
      return model || 'claude-3-5-sonnet-latest' // Respect client-selected Anthropic model, default to Claude 3.5 Sonnet
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

export async function generateResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  provider: ProviderType,
  model?: string
): Promise<void> {
  const providerModel = getProviderModel(provider, model)
  const aiSdkMessages = messages
    .filter(msg => msg.content && msg.content.trim() !== '') // Remove empty messages
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

  switch (provider) {
    case 'ollama':
      return ollamaGenerate(messages, onChunk, providerModel)
    case 'gemini':
      return geminiGenerate(aiSdkMessages, onChunk, providerModel)
    case 'anthropic':
      return anthropicGenerate(aiSdkMessages, onChunk, providerModel)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
