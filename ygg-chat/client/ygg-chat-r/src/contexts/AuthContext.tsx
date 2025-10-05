import React, { createContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { updateThunkExtraAuth } from '../store/thunkExtra'

interface AuthContextType {
  user: User | null
  session: Session | null
  accessToken: string | null
  userId: string | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        const newAccessToken = initialSession?.access_token ?? null
        const newUserId = initialSession?.user?.id ?? null

        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        setAccessToken(newAccessToken)
        setUserId(newUserId)

        // Update Redux thunk extra argument
        updateThunkExtraAuth(newAccessToken, newUserId)

        console.log('[AuthContext] Initial session loaded:', newUserId ?? 'none')
      } catch (error) {
        console.error('[AuthContext] Failed to get initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes (single listener for entire app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newAccessToken = newSession?.access_token ?? null
      const newUserId = newSession?.user?.id ?? null

      setSession(newSession)
      setUser(newSession?.user ?? null)
      setAccessToken(newAccessToken)
      setUserId(newUserId)

      // Update Redux thunk extra argument whenever auth changes
      updateThunkExtraAuth(newAccessToken, newUserId)

      console.log('[AuthContext] Auth state changed:', newUserId ?? 'signed out')
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    user,
    session,
    accessToken,
    userId,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
