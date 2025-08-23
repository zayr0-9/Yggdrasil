// utils/api.ts

// Base configuration
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Core API utility function
export const apiCall = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const isFormData = options?.body && typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
  }

  return response.json()
}

// Convenience methods for common HTTP operations
export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiCall<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiCall<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiCall<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'DELETE' }),
}

// Helper for streaming requests
export const createStreamingRequest = (endpoint: string, options?: RequestInit): Promise<Response> => {
  const isFormData = options?.body && typeof FormData !== 'undefined' && options.body instanceof FormData
  return fetch(`${API_BASE}${endpoint}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    ...options,
  })
}

// Specific helpers for conversation system prompt endpoints
export type SystemPromptGetResponse = { systemPrompt: string | null }
export type SystemPromptPatchResponse = { id: number; system_prompt: string | null }
export type ConversationPatchResponse = {
  id: number
  system_prompt?: string | null
  conversation_context?: string | null
}
export type ConversationContextGetResponse = { context: string | null }

export const getConversationSystemPrompt = (conversationId: number) =>
  api.get<SystemPromptGetResponse>(`/conversations/${conversationId}/system-prompt`)

export const getConversationContext = (conversationId: number) =>
  api.get<ConversationContextGetResponse>(`/conversations/${conversationId}/context`)

export const patchConversationSystemPrompt = (conversationId: number, systemPrompt: string | null) =>
  api.patch<SystemPromptPatchResponse>(`/conversations/${conversationId}/system-prompt`, { systemPrompt })

export const patchConversationContext = (conversationId: number, context: string | null) =>
  api.patch<ConversationPatchResponse>(`/conversations/${conversationId}/context`, { context })
