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
  type: 'chunk' | 'complete' | 'error' | 'user_message' | 'reset' | 'generation_started'
  content?: string
  // delta is used for token-level updates from the server
  delta?: string
  // part distinguishes normal text from reasoning tokens
  part?: 'text' | 'reasoning'
  message?: Message
  error?: string
  // optional iteration index for multi-reply endpoints
  iteration?: number
  messageId?: number
}

export interface StreamState {
  active: boolean
  buffer: string
  // separate buffer for reasoning/thinking tokens while streaming
  thinkingBuffer: string
  messageId: number | null
  error: string | null
  finished: boolean
  streamingMessageId: number | null
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

export interface Provider {
  name: string
  url: string
  description: string
}

export interface ProviderState {
  providers: Provider[]
  currentProvider: string | null
  loading: boolean
  error: string | null
}

// Message composition types
export interface ImageDraft {
  dataUrl: string
  name: string
  type: string
  size: number
}

export interface MessageInput {
  content: string
  modelOverride?: string
}

export interface CompositionState {
  input: MessageInput
  sending: boolean
  validationError: string | null
  draftMessage: String | null
  multiReplyCount: number
  imageDrafts: ImageDraft[] // base64-encoded images + metadata from drag/drop
  editingBranch: boolean // true when user is editing a branch; controls UI like hiding image drafts
}

export interface ConversationState {
  currentConversationId: number | null
  focusedChatMessageId: number | null
  currentPath: number[] // Array of message IDs forming current branch
  messages: Message[] // Linear messages in current path order
  bookmarked: number[] //each index contains id of a message selected
  excludedMessages: number[] //id of each message which are NOT to be sent for chat,
  context: string
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
  providerState: ProviderState
  composition: CompositionState
  streaming: StreamState
  ui: {
    modelSelectorOpen: boolean
  }
  conversation: ConversationState
  heimdall: HeimdallState
  initialization: InitializationState
  selectedNodes: number[]
  attachments: AttachmentsState
}

// Action payloads
export interface SendMessagePayload {
  conversationId: number
  input: MessageInput
  parent: number
  repeatNum: number
  think: boolean
}

export interface EditMessagePayload {
  conversationId: number
  originalMessageId: number
  newContent: string
  modelOverride?: string
  systemPrompt?: string
  think: boolean
}

export interface BranchMessagePayload {
  conversationId: number
  parentId: number
  content: string
  modelOverride?: string
  systemPrompt?: string
  think: boolean
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

// Attachment types (mirror server `Attachment` interface)
export interface Attachment {
  id: number
  message_id: number | null
  kind: 'image'
  mime_type: string
  storage: 'file' | 'url'
  url?: string | null
  file_path?: string | null
  width?: number | null
  height?: number | null
  size_bytes?: number | null
  sha256?: string | null
  created_at: string
}

export interface AttachmentsState {
  byMessage: Record<number, Attachment[]>
  // Backup of deleted image artifacts (as base64 data URLs) per message during branch editing
  backup: Record<number, string[]>
}
