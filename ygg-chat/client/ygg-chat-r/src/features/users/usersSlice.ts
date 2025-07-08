// features/users/usersSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User, UserState } from './usersTypes'

// LocalStorage keys
const USER_STORAGE_KEY = 'yggdrasil_user'

// Helper functions for localStorage
const saveUserToStorage = (user: User) => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  } catch (error) {
    console.error('Failed to save user to localStorage:', error)
  }
}

const loadUserFromStorage = (): User | null => {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error('Failed to load user from localStorage:', error)
    return null
  }
}

const removeUserFromStorage = () => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to remove user from localStorage:', error)
  }
}

// Async thunks
export const loginUser = createAsyncThunk<User, string>(
  'users/loginUser',
  async (username: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.error || 'Failed to login')
      }

      const user = await response.json()
      saveUserToStorage(user)
      return user
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error')
    }
  }
)

// Initial state
const initialState: UserState = {
  currentUser: loadUserFromStorage(),
  loading: false,
  error: null,
}




// Slice
const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearUser: state => {
      state.currentUser = null
      state.error = null
      removeUserFromStorage()
    },
    clearError: state => {
      state.error = null
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload
      state.error = null
      saveUserToStorage(action.payload)
    },
  },
  extraReducers: builder => {
    builder
      // loginUser
      .addCase(loginUser.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.currentUser = action.payload
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export const { clearUser, clearError, setUser } = usersSlice.actions
export default usersSlice.reducer
