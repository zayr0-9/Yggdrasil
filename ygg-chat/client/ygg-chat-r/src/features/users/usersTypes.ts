// features/users/usersTypes.ts

export interface User {
  id: number
  username: string
  created_at: string
}

export interface UserState {
  currentUser: User | null
  loading: boolean
  error: string | null //or could split into error Boolean and errorMessage
}

export interface LoginUserPayload {
  username: string
}
