// This file contains types shared between client and server
export interface BaseMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  thinking_block?: string
  content: string
  parent_id?: number | null
  children_ids: number[]
  created_at: string // ISO timestamp, consistent naming
  updated_at?: string
  model_name: string
  partial: boolean
  // Optional metadata for optimized attachment fetching
  has_attachments?: boolean
  attachments_count?: number
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
  message: BaseMessage
  chatId: string
}

export interface ErrorResponse {
  error: boolean
  message?: string
}
