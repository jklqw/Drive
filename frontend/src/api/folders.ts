import api from './client'
import type { ContentsResponse, Folder } from './types'

export const foldersApi = {
  async contents(folderId: string | null): Promise<ContentsResponse> {
    const { data } = await api.get<ContentsResponse>(
      folderId ? `/folders/${folderId}/contents` : '/folders',
    )
    return data
  },
  async create(name: string, parentId: string | null): Promise<Folder> {
    const { data } = await api.post<Folder>('/folders', { name, parent_id: parentId })
    return data
  },
  async rename(id: string, name: string): Promise<Folder> {
    const { data } = await api.patch<Folder>(`/folders/${id}`, { name })
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/folders/${id}`)
  },
}
