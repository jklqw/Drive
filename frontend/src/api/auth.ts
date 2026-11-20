import api from './client'
import type { TokenResponse, User } from './types'

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  full_name: string
}

export const authApi = {
  async login(credentials: Credentials): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', credentials)
    return data
  },
  async register(registration: Registration): Promise<User> {
    const { data } = await api.post<User>('/auth/register', registration)
    return data
  },
  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },
  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },
}
