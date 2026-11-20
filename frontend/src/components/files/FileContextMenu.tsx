import { Download, Link2, Pencil, Trash2 } from 'lucide-react'
import type { FileRecord } from '../../api/types'

interface FileContextMenuProps {
  file: FileRecord
  x: number
  y: number
  onClose: () => void
  onDownload: (file: FileRecord) => void
  onShare: (file: FileRecord) => void
  onRename: (file: FileRecord) => void
  onDelete: (file: FileRecord) => void
}

export function FileContextMenu({ file, x, y, onClose, onDownload, onShare, onRename, onDelete }: FileContextMenuProps) {
  const left = Math.min(x, window.innerWidth - 190)
  const top = Math.min(y, window.innerHeight - 190)
  const actions = [
    { label: 'Download', icon: Download, danger: false, run: () => onDownload(file) },
    { label: 'Share link', icon: Link2, danger: false, run: () => onShare(file) },
    { label: 'Rename', icon: Pencil, danger: false, run: () => onRename(file) },
    { label: 'Delete', icon: Trash2, danger: true, run: () => onDelete(file) },
  ]

  return (
    <>
      <button type="button" aria-label="Close menu" className="fixed inset-0 z-[65] cursor-default" onClick={onClose} />
      <div
        role="menu"
        className="fixed z-[66] w-44 rounded-lg border border-border bg-surface py-1 shadow-lg"
        style={{ left, top }}
      >
        <p className="truncate border-b border-border px-3 py-2 text-[10.5px] font-medium text-ink-tertiary">{file.original_filename}</p>
        {actions.map(({ label, icon: Icon, danger, run }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              run()
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-canvas ${danger ? 'text-status-danger' : 'text-ink-primary'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </>
  )
}
