// store.ts
import { configureStore } from '@reduxjs/toolkit'
import { chatReducer } from '../features/chats'
import { conversationsReducer } from '../features/conversations'
import { default as searchReducer } from '../features/search/searchSlice'
import { usersReducer } from '../features/users'
import { default as projectsReducer } from '../features/projects/projectSlice'

// Root reducer configuration
const rootReducer = {
  users: usersReducer,
  chat: chatReducer,
  conversations: conversationsReducer,
  search: searchReducer,
  projects: projectsReducer,
}

// Main store for the app
export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Store factory for testing with preloaded state
export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  })
}

// Types
export type RootState = ReturnType<typeof store.getState>
export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = typeof store.dispatch
