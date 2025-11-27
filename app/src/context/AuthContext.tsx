import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin' | 'collaborator' | null

const ROLE_CACHE_PREFIX = 'razai-role:'

const readCachedRole = (userId?: string | null): UserRole => {
  if (!userId || typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(`${ROLE_CACHE_PREFIX}${userId}`)
  return value === 'admin' ? 'admin' : value === 'collaborator' ? 'collaborator' : null
}

const writeCachedRole = (userId: string, role: UserRole | null) => {
  if (typeof window === 'undefined') return
  if (!role) {
    window.sessionStorage.removeItem(`${ROLE_CACHE_PREFIX}${userId}`)
  } else {
    window.sessionStorage.setItem(`${ROLE_CACHE_PREFIX}${userId}`, role)
  }
}

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
    let sessionToken = 0

    const normalizeRole = (raw?: string | null): UserRole => (raw === 'admin' ? 'admin' : 'collaborator')

    const resolveSession = async (nextSession: Session | null) => {
      if (!isMounted) return

      const currentToken = ++sessionToken
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        setRole(null)
        setLoading(false)
        return
      }

      const cachedRole = readCachedRole(nextSession.user.id)
      if (cachedRole) {
        setRole(cachedRole)
        setLoading(false)
      } else {
        setLoading(true)
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', nextSession.user.id)
          .single()

        if (!isMounted || currentToken !== sessionToken) return

        if (error) {
          console.error('[auth] Role fetch error:', error.message)
          const fallback = normalizeRole(undefined)
          setRole(fallback)
          writeCachedRole(nextSession.user.id, fallback)
        } else {
          const resolved = normalizeRole(data?.role ?? null)
          setRole(resolved)
          writeCachedRole(nextSession.user.id, resolved)
        }
      } catch (err) {
        if (!isMounted || currentToken !== sessionToken) return
        console.error('[auth] Role fetch exception:', err)
        const fallback = normalizeRole(undefined)
        setRole(fallback)
        writeCachedRole(nextSession.user.id, fallback)
      } finally {
        if (isMounted && currentToken === sessionToken) {
          setLoading(false)
        }
      }
    }

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[auth] Initial session:', session ? 'logged in' : 'no session')
        if (!isMounted) return
        await resolveSession(session)
      } catch (err) {
        if (!isMounted) return
        console.error('[auth] getSession error:', err)
        setSession(null)
        setUser(null)
        setRole(null)
        setLoading(false)
      }
    }

    init()

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      console.log('[auth] Auth state changed:', _event, nextSession ? 'has session' : 'no session')
      resolveSession(nextSession)
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
