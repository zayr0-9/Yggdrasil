// features/users/usersTypes.ts

export interface User {
  id: number
  username: string
  created_at: string
}

export interface UserState {
  currentUser: User | null
  loading: boolean
  error: string | null
}

export interface LoginUserPayload {
  username: string
}
