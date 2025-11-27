import React, { useEffect, useState } from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'collaborator')[]
  redirectPath?: string
}

export default function ProtectedRoute({ allowedRoles, redirectPath = '/login' }: ProtectedRouteProps) {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'admin' | 'collaborator'>('admin')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const loadUserAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[ProtectedRoute] Session check:', session ? 'has session' : 'no session')
        
        if (!mounted) return
        
        if (!session?.user) {
          setUser(null)
          setLoading(false)
          return
        }
        
        setUser(session.user)
        
        // Fetch role from profiles table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (!mounted) return
        
        if (error) {
          console.log('[ProtectedRoute] Profile fetch error:', error.message)
        }
        
        const userRole = (profile?.role as 'admin' | 'collaborator') || 'admin'
        console.log('[ProtectedRoute] User role:', userRole)
        setRole(userRole)
        setLoading(false)
      } catch (err) {
        console.error('[ProtectedRoute] Error:', err)
        if (mounted) setLoading(false)
      }
    }
    
    loadUserAndRole()

    // Listen for changes - but don't set loading again
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[ProtectedRoute] Auth changed:', _event)
      
      if (!session?.user) {
        setUser(null)
        setRole('admin')
        return
      }
      
      setUser(session.user)
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        setRole((profile?.role as 'admin' | 'collaborator') || 'admin')
      } catch (err) {
        console.error('[ProtectedRoute] Role fetch error:', err)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  console.log('[ProtectedRoute] State:', { user: !!user, role, loading, path: location.pathname })

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>Carregando...</div>
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to={redirectPath} state={{ from: location }} replace />
  }

  // Role check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      console.log('[ProtectedRoute] Role not allowed:', role, 'allowed:', allowedRoles)
      if (role === 'collaborator') return <Navigate to="/mobile" replace />
      return <Navigate to="/" replace />
    }
  }

  console.log('[ProtectedRoute] Access granted!')
  return <Outlet />
}
