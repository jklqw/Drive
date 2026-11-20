import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DrivePage } from './pages/DrivePage'
import { PublicSharePage } from './pages/PublicSharePage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-secondary">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/drive" replace />
  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/s/:token" element={<PublicSharePage />} />
      <Route
        path="/drive"
        element={
          <ProtectedRoute>
            <DrivePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  )
}

export default App
