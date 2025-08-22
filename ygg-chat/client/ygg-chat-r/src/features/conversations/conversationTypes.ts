export interface Conversation {
  id: number
  user_id: number
  title: string | null
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
}
