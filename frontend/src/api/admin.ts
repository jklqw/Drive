import api from './client'
import type { AdminOverview, AdminUser, AuditEntry } from './types'

export interface AuditFilters {
  action?: string
  status?: string
  limit?: number
}

export const adminApi = {
  async overview(): Promise<AdminOverview> {
    const { data } = await api.get<AdminOverview>('/admin/overview')
    return data
  },
  async users(): Promise<AdminUser[]> {
    const { data } = await api.get<AdminUser[]>('/admin/users')
    return data
  },
  async updateUser(id: string, patch: { storage_quota_bytes?: number; is_active?: boolean }): Promise<AdminUser> {
    const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, patch)
    return data
  },
  async auditLogs(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    const { data } = await api.get<AuditEntry[]>('/admin/audit-logs', { params: filters })
    return data
  },
}
