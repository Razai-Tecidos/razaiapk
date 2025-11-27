import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'collaborator')[]
  redirectPath?: string
}

export default function ProtectedRoute({ allowedRoles, redirectPath = '/login' }: ProtectedRouteProps) {
  const location = useLocation()
  const { user, role, loading } = useAuth()
  const effectiveRole = role || 'collaborator'

  console.log('[ProtectedRoute] State:', { user: !!user, role: effectiveRole, loading, path: location.pathname })

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>Carregando...</div>
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to={redirectPath} state={{ from: location }} replace />
  }

  // Role check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(effectiveRole)) {
      console.log('[ProtectedRoute] Role not allowed:', effectiveRole, 'allowed:', allowedRoles)
      if (effectiveRole === 'collaborator') return <Navigate to="/mobile" replace />
      return <Navigate to="/" replace />
    }
  }

  console.log('[ProtectedRoute] Access granted!')
  return <Outlet />
}
