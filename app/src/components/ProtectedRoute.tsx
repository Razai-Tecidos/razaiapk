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
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Check session directly from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[ProtectedRoute] Direct session check:', session ? 'has session' : 'no session')
      setUser(session?.user ?? null)
      setLoading(false)
      setChecked(true)
    })

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[ProtectedRoute] Auth changed:', _event)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  console.log('[ProtectedRoute] State:', { user: !!user, loading, checked, path: location.pathname })

  if (loading && !user) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>Carregando...</div>
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to={redirectPath} state={{ from: location }} replace />
  }

  // Role check - default to admin if no role in metadata
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user.user_metadata?.role as 'admin' | 'collaborator') || 'admin'
    if (!allowedRoles.includes(userRole)) {
      console.log('[ProtectedRoute] Role not allowed:', userRole)
      if (userRole === 'collaborator') return <Navigate to="/mobile" replace />
      return <Navigate to="/" replace />
    }
  }

  console.log('[ProtectedRoute] Access granted!')
  return <Outlet />
}
