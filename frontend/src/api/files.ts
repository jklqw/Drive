import api from './client'
import type { FileRecord } from './types'

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const filesApi = {
  async upload(
    file: File,
    folderId: string | null,
    onProgress?: (percent: number) => void,
  ): Promise<FileRecord> {
    const form = new FormData()
    form.append('file', file)
    if (folderId) form.append('folder_id', folderId)
    const { data } = await api.post<FileRecord>('/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && event.total > 0) onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      },
    })
    return data
  },
  async download(file: FileRecord): Promise<void> {
    const { data } = await api.get<Blob>(`/files/${file.id}/download`, { responseType: 'blob' })
    saveBlob(data, file.original_filename)
  },
  async rename(id: string, name: string): Promise<FileRecord> {
    const { data } = await api.patch<FileRecord>(`/files/${id}`, { name })
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/files/${id}`)
  },
}
