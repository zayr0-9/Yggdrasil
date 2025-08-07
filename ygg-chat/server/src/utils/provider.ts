// server/src/utils/provider.ts
import { Message } from '../database/models'
import { generateResponse as geminiGenerate } from './gemini'
import { generateResponse as ollamaGenerate } from './ollama'

export type ProviderType = 'ollama' | 'gemini'

function getProviderModel(provider: ProviderType, model?: string): string {
  switch (provider) {
    case 'ollama':
      return model || 'gpt-oss:20b' // Use ollama model as-is
    case 'gemini':
      return 'gemini-2.5-flash' // Always use gemini-pro for Gemini
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

  switch (provider) {
    case 'ollama':
      return ollamaGenerate(messages, onChunk, providerModel)
    case 'gemini':
      return geminiGenerate(messages, onChunk, providerModel)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
