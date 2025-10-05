// Store extra argument type for thunks - provides auth context to all Redux actions
export interface ThunkExtraArgument {
  auth: {
    accessToken: string | null
    userId: string | null
  }
}

// This will be populated by the store middleware with current auth state
export let thunkExtraArg: ThunkExtraArgument = {
  auth: {
    accessToken: null,
    userId: null,
  },
}

// Function to update the thunk extra argument with current auth state
export const updateThunkExtraAuth = (accessToken: string | null, userId: string | null) => {
  thunkExtraArg.auth.accessToken = accessToken
  thunkExtraArg.auth.userId = userId
}
