import { useCallback, useState } from 'react'
import { filesApi } from '../../api/files'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export interface UploadItem {
  id: number
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

let uploadCounter = 0

export function useUploader(folderId: string | null, onComplete: () => void) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [active, setActive] = useState(false)
  const { refreshUser } = useAuth()
  const { notify } = useToast()

  const update = useCallback((id: number, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const enqueue = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setActive(true)
      setItems([])
      for (const file of files) {
        const id = ++uploadCounter
        setItems((current) => [
          ...current,
          { id, name: file.name, progress: 0, status: 'uploading' },
        ])
        try {
          await filesApi.upload(file, folderId, (progress) => update(id, { progress }))
          update(id, { progress: 100, status: 'done' })
          notify(`${file.name} uploaded`, 'success')
        } catch (error) {
          const message = errorMessage(error, 'Upload rejected')
          update(id, { status: 'error', error: message })
          notify(`${file.name}: ${message}`, 'error')
        }
      }
      await refreshUser()
      onComplete()
      setActive(false)
    },
    [folderId, notify, onComplete, refreshUser, update],
  )

  const clear = useCallback(() => setItems([]), [])

  return { items, active, enqueue, clear }
}
