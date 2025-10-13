import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found in environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // CRITICAL: autoRefreshToken MUST be false to prevent /auth/v1/user calls
    // We handle token refresh manually to maintain full control
    autoRefreshToken: false,
    detectSessionInUrl: true,
    // Asymmetric JWT verification settings
    // Uses JWKS from /.well-known/jwks.json for local token verification
    // IMPORTANT: With asymmetric JWTs, getClaims() performs LOCAL verification
    // This eliminates ALL network calls to /auth/v1/user endpoint
    storageKey: 'supabase-auth-token',
  }
})
