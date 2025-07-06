// server/src/utils/modelService.ts
interface OllamaModel {
  name: string
}

interface OllamaResponse {
  models: OllamaModel[]
}

class ModelService {
  private static instance: ModelService
  private cachedModels: string[] = []
  private defaultModel: string = 'llama2' // ultimate fallback
  private lastFetch: number = 0
  private readonly CACHE_TTL = 60000 // 1 minute cache

  private constructor() {}

  static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService()
    }
    return ModelService.instance
  }

  async getAvailableModels(): Promise<{ models: string[]; default: string }> {
    const now = Date.now()

    // Return cached if valid
    if (this.cachedModels.length > 0 && now - this.lastFetch < this.CACHE_TTL) {
      return {
        models: this.cachedModels,
        default: this.defaultModel,
      }
    }

    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(5000), // 5s timeout
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const data = (await response.json()) as OllamaResponse
      const models = data.models.map(m => m.name)

      if (models.length === 0) {
        throw new Error('No models available')
      }

      // Update cache
      this.cachedModels = models
      this.defaultModel = models[0]
      this.lastFetch = now

      return {
        models: this.cachedModels,
        default: this.defaultModel,
      }
    } catch (error) {
      console.error('Failed to fetch models from Ollama:', error)

      // Return cached if available, otherwise fallback
      if (this.cachedModels.length > 0) {
        return {
          models: this.cachedModels,
          default: this.defaultModel,
        }
      }

      // Ultimate fallback
      return {
        models: ['llama2'],
        default: 'llama2',
      }
    }
  }

  async getDefaultModel(): Promise<string> {
    const { default: defaultModel } = await this.getAvailableModels()
    return defaultModel
  }

  // Force refresh cache
  async refreshModels(): Promise<{ models: string[]; default: string }> {
    this.lastFetch = 0
    this.cachedModels = []
    return this.getAvailableModels()
  }
}

export const modelService = ModelService.getInstance()
