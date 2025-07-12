// This file contains types shared between client and server
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  chatId: string
}

export interface ChatSession {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
}

export interface ChatRequest {
  message: string
  chatId?: string
  model?: string
}

export interface ChatResponse {
  message: ChatMessage
  chatId: string
}

export interface ErrorResponse {
  error: boolean
  message?: string
}
