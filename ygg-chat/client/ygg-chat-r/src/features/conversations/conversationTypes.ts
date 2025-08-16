export interface Conversation {
  id: number
  user_id: number
  title: string | null
  created_at: string
  updated_at: string
}

export interface ConversationsState {
  items: Conversation[]
  loading: boolean
  error: string | null
}
