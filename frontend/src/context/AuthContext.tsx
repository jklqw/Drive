import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, type Credentials, type Registration } from '../api/auth'
import { setAccessToken, setAuthLostHandler } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (registration: Registration) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.me()
      setUser(profile)
      return profile
    } catch {
      setUser(null)
      setAccessToken(null)
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    setAuthLostHandler(() => setUser(null))
    authApi
      .me()
      .then((profile) => {
        if (active) setUser(profile)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      setAuthLostHandler(() => {})
    }
  }, [])

  const login = useCallback(async (credentials: Credentials) => {
    const tokens = await authApi.login(credentials)
    setAccessToken(tokens.access_token)
    await refreshUser()
  }, [refreshUser])

  const register = useCallback(async (registration: Registration) => {
    await authApi.register(registration)
    await login({ email: registration.email, password: registration.password })
  }, [login])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
