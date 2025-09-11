import { BaseModel } from '../../../../../shared/types'

export interface Conversation {
  id: number
  user_id: number
  title: string | null
  project_id?: number | null
  created_at: string
  updated_at: string
  systemPrompt: string | null
}

export interface ConversationsState {
  items: Conversation[]
  loading: boolean
  error: string | null
  activeConversationId: number | null
  systemPrompt: string | null
  convContext: string | null
  // Recently updated conversations for quick access
  recent: RecentConversationsState
  // Recently used model names (normalized to BaseModel)
  recentModels: RecentModelState
}

export interface RecentConversationsState {
  items: Conversation[]
  loading: boolean
  error: string | null
}

export interface RecentModelState {
  items: BaseModel[]
  loading: boolean
  error: string | null
}
