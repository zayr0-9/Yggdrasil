import { BaseMessage } from '../../../../../shared/types'

// Message types (shared with conversations)
export interface Message extends BaseMessage {
  //media: Blob or path to file
  pastedContext: string[]
  artifacts: string[]
  //should write a function which extracts text content
  //when user drags and drops it on the input component
}

export interface miniMessage {
  content: string
  media: Blob | null
}

// Stream-specific types
export interface StreamChunk {
  type: 'chunk' | 'complete' | 'error' | 'user_message' | 'reset'
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
  draftMessage: String | null
  multiReplyCount: number
}

export interface ConversationState {
  currentConversationId: number | null
  currentPath: number[] // Array of message IDs forming current branch
  messages: Message[] // Linear messages in current path order
  bookmarked: number[] //each index contains id of a message selected
  excludedMessages: number[] //id of each message which are NOT to be sent for chat,
}

// Core chat state - ONLY chat concerns
export interface ChatNode {
  id: string
  message: string
  sender: 'user' | 'assistant'
  children: ChatNode[]
}

export interface HeimdallState {
  treeData: ChatNode | null
  loading: boolean
  error: string | null
  compactMode: boolean
}

export interface InitializationState {
  loading: boolean
  error: string | null
  userId: number | null
}

export interface ChatState {
  models: ModelState
  composition: CompositionState
  streaming: StreamState
  ui: {
    modelSelectorOpen: boolean
  }
  conversation: ConversationState
  heimdall: HeimdallState
  initialization: InitializationState
}

// Action payloads
export interface SendMessagePayload {
  conversationId: number
  input: MessageInput
  parent: number
  repeatNum: number
}

export interface EditMessagePayload {
  conversationId: number
  originalMessageId: number
  newContent: string
  modelOverride?: string
  systemPrompt?: string
}

export interface BranchMessagePayload {
  conversationId: number
  parentId: number
  content: string
  modelOverride?: string
  systemPrompt?: string
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
