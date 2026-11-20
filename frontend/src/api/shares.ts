import api from './client'
import type { CreateShareResponse, PublicShareInfo, ShareLink } from './types'

export interface ShareOptions {
  expires_in_hours: number | null
  max_downloads: number | null
}

export const sharesApi = {
  async create(fileId: string, options: ShareOptions): Promise<CreateShareResponse> {
    const { data } = await api.post<CreateShareResponse>(`/files/${fileId}/share`, options)
    return data
  },
  async list(): Promise<ShareLink[]> {
    const { data } = await api.get<ShareLink[]>('/shares')
    return data
  },
  async revoke(id: string): Promise<void> {
    await api.delete(`/shares/${id}`)
  },
  async publicInfo(token: string): Promise<PublicShareInfo> {
    const { data } = await api.get<PublicShareInfo>(`/public/share/${token}`)
    return data
  },
  async publicDownload(token: string): Promise<Blob> {
    const { data } = await api.get<Blob>(`/public/share/${token}/download`, { responseType: 'blob' })
    return data
  },
}
