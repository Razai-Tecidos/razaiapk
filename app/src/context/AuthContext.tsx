import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin' | 'collaborator' | null

interface AuthContextType {
  session: Session | null
  user: User | null
  role: UserRole
  loading: boolean
  signIn: (email: string, pass: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: 'Not implemented' }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  console.log('[AuthProvider] Render - loading:', loading, 'user:', !!user)

  useEffect(() => {
    let isMounted = true
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      console.log('[auth] Initial session:', session ? 'logged in' : 'no session')
      setSession(session)
      setUser(session?.user ?? null)
      setRole((session?.user?.user_metadata?.role as UserRole) || 'admin')
      console.log('[auth] Setting loading to false')
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      console.log('[auth] Auth state changed:', _event, session ? 'has session' : 'no session')
      setSession(session)
      setUser(session?.user ?? null)
      setRole((session?.user?.user_metadata?.role as UserRole) || 'admin')
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
