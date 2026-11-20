import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from 'lucide-react'
import clsx from 'clsx'
import type { UploadItem } from './useUploader'

interface DragDropOverlayProps {
  items: UploadItem[]
  active: boolean
  onFiles: (files: File[]) => void
  onClear: () => void
}

export function DragDropOverlay({ items, active, onFiles, onClear }: DragDropOverlayProps) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    function isFileDrag(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }
    function onEnter(event: DragEvent) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    }
    function onOver(event: DragEvent) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    function onLeave(event: DragEvent) {
      if (!isFileDrag(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    function onDrop(event: DragEvent) {
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length) onFiles(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFiles])

  return (
    <>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-ink-primary/20 p-8 backdrop-blur-[2px]">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand bg-surface/95 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand">
              <FileUp size={24} />
            </span>
            <p className="mt-5 text-[17px] font-semibold tracking-tight text-ink-primary">Drop files to upload</p>
            <p className="mt-1.5 text-[12px] text-ink-secondary">
              Files are inspected and stored in your isolated vault.
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[70] w-[340px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink-primary">
              {active ? 'Uploading files' : 'Upload complete'}
            </p>
            {!active && (
              <button type="button" onClick={onClear} className="text-ink-tertiary hover:text-ink-primary" aria-label="Dismiss uploads">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-56 space-y-3 overflow-y-auto px-4 py-3">
            {items.map((item) => (
              <div key={item.id}>
                <div className="flex items-center gap-2">
                  {item.status === 'uploading' && <Loader2 size={13} className="animate-spin text-brand" />}
                  {item.status === 'done' && <CheckCircle2 size={13} className="text-status-success" />}
                  {item.status === 'error' && <AlertCircle size={13} className="text-status-danger" />}
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-primary">{item.name}</span>
                  <span className="font-mono text-[10px] text-ink-tertiary">
                    {item.status === 'error' ? 'blocked' : `${item.progress}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-canvas">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      item.status === 'error' ? 'bg-status-danger' : item.status === 'done' ? 'bg-status-success' : 'bg-brand',
                    )}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                {item.error && <p className="mt-1 text-[10.5px] text-status-danger">{item.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
