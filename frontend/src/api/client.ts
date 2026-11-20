import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

export const API_BASE = '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let accessToken: string | null = null
let refreshInFlight: Promise<boolean> | null = null
let authLostHandler: () => void = () => {}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function setAuthLostHandler(handler: () => void) {
  authLostHandler = handler
}

api.interceptors.request.use((config) => {
  if (accessToken && !config.url?.includes('/auth/refresh')) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post<{ access_token: string }>('/auth/refresh', {})
      .then((response) => {
        setAccessToken(response.data.access_token)
        return true
      })
      .catch(() => {
        setAccessToken(null)
        authLostHandler()
        return false
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthEndpoint = config?.url?.includes('/auth/') ?? false
    if (error.response?.status === 401 && config && !config._retry && !isAuthEndpoint) {
      config._retry = true
      if (await refreshSession()) {
        return api(config)
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string | { msg?: string } } | undefined
    if (typeof data?.detail === 'string') return data.detail
    if (data?.detail?.msg) return data.detail.msg
    if (error.code === 'ERR_NETWORK') return 'Network unavailable. Check the connection and try again.'
  }
  return fallback
}

export default api
