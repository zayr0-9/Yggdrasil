// Message types (shared with conversations)
export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Stream-specific types
export interface StreamChunk {
  type: 'chunk' | 'complete' | 'error' | 'user_message'
  content?: string
  message?: Message
  error?: string
}

export interface StreamState {
  active: boolean
  buffer: string
  messageId: number | null
  error: string | null
}

// Model types - simplified to match server
export interface ModelState {
  available: string[] // Just model names
  selected: string | null
  default: string | null // Default model from server
  loading: boolean
  error: string | null
  lastRefresh: number | null
}

// Message composition types
export interface MessageInput {
  content: string
  modelOverride?: string
  systemPrompt?: string
}

export interface CompositionState {
  input: MessageInput
  sending: boolean
  validationError: string | null
}

// Core chat state - ONLY chat concerns
export interface ChatState {
  models: ModelState
  composition: CompositionState
  streaming: StreamState
  ui: {
    modelSelectorOpen: boolean
  }
}

// Action payloads
export interface SendMessagePayload {
  conversationId: number
  input: MessageInput
}

export interface ModelSelectionPayload {
  modelName: string
  persist?: boolean
}

// Server response types
export interface ModelsResponse {
  models: string[]
  default: string
}

// Re-export for backward compatibility if needed
export type Model = string
