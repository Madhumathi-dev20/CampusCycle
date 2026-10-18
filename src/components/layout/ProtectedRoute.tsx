import { Loader2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, profile, isAdmin, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>
  }

  if (!user) return <Navigate to="/login" state={{ from: window.location.pathname }} replace />
  if (!profile || profile.account_status !== 'active') return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
