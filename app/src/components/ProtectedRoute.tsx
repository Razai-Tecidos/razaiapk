import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'collaborator')[]
  redirectPath?: string
}

export default function ProtectedRoute({ allowedRoles, redirectPath = '/login' }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>Carregando...</div>
  }

  if (!user) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // User is logged in but doesn't have permission
    // Redirect to their appropriate home based on role
    if (role === 'collaborator') return <Navigate to="/mobile" replace />
    if (role === 'admin') return <Navigate to="/" replace />
    return <Navigate to={redirectPath} replace />
  }

  return <Outlet />
}
