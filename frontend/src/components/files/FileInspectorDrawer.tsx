import { useState } from 'react'
import { Copy, Download, Link2, Pencil, Trash2, X } from 'lucide-react'
import { filesApi } from '../../api/files'
import { errorMessage } from '../../api/client'
import type { FileRecord } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { formatBytes, formatDate, shortHash } from '../../lib/format'
import { Modal } from '../ui/Modal'

interface FileInspectorDrawerProps {
  file: FileRecord | null
  onClose: () => void
  onShare: (file: FileRecord) => void
  onChanged: () => void
}

export function FileInspectorDrawer({ file, onClose, onShare, onChanged }: FileInspectorDrawerProps) {
  const { notify } = useToast()
  const [copied, setCopied] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!file) return null

  async function copyHash() {
    if (!file) return
    await navigator.clipboard.writeText(file.sha256_hash)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function handleRename() {
    if (!file || !renameValue.trim()) return
    setBusy(true)
    try {
      await filesApi.rename(file.id, renameValue.trim())
      notify('File renamed', 'success')
      setRenameOpen(false)
      onChanged()
      onClose()
    } catch (error) {
      notify(errorMessage(error, 'Unable to rename'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!file) return
    setBusy(true)
    try {
      await filesApi.remove(file.id)
      notify('File deleted', 'success')
      setDeleteOpen(false)
      onChanged()
      onClose()
    } catch (error) {
      notify(errorMessage(error, 'Unable to delete'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rows = [
    { label: 'Size', value: formatBytes(file.size_bytes), mono: true },
    { label: 'Type', value: file.detected_mime_type, mono: true },
    { label: 'Extension', value: `.${file.extension}`, mono: true },
    { label: 'Uploaded', value: formatDate(file.created_at), mono: false },
  ]

  return (
    <>
      <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-tertiary">Details</p>
          <button type="button" onClick={onClose} aria-label="Close inspector" className="rounded p-1 text-ink-tertiary hover:bg-canvas hover:text-ink-primary">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="break-all text-[15px] font-semibold leading-snug tracking-tight text-ink-primary">{file.original_filename}</p>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                <span className="text-[11.5px] text-ink-secondary">{row.label}</span>
                <span className={`text-right text-[11.5px] text-ink-primary ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <p className="text-[11px] text-ink-secondary">SHA-256 fingerprint</p>
            <button
              type="button"
              onClick={() => void copyHash()}
              title="Copy full checksum"
              className="mt-1.5 flex w-full items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-2 text-left font-mono text-[10.5px] text-ink-primary hover:border-border-strong"
            >
              <span className="flex-1 break-all">{shortHash(file.sha256_hash)}</span>
              <Copy size={13} className={copied ? 'text-status-success' : 'text-ink-tertiary'} />
            </button>
            {copied && <p className="mt-1 text-[10px] text-status-success">Checksum copied</p>}
          </div>
          <div className="mt-6 space-y-1.5">
            <button
              type="button"
              onClick={() => void filesApi.download(file).catch(() => notify('Download failed', 'error'))}
              className="flex h-9 w-full items-center gap-2.5 rounded-md border border-border px-3 text-[12px] font-medium text-ink-primary hover:bg-canvas"
            >
              <Download size={14} /> Download
            </button>
            <button
              type="button"
              onClick={() => onShare(file)}
              className="flex h-9 w-full items-center gap-2.5 rounded-md border border-border px-3 text-[12px] font-medium text-ink-primary hover:bg-canvas"
            >
              <Link2 size={14} /> Manage sharing
            </button>
            <button
              type="button"
              onClick={() => { setRenameValue(file.original_filename); setRenameOpen(true) }}
              className="flex h-9 w-full items-center gap-2.5 rounded-md border border-border px-3 text-[12px] font-medium text-ink-primary hover:bg-canvas"
            >
              <Pencil size={14} /> Rename
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex h-9 w-full items-center gap-2.5 rounded-md border border-red-200 px-3 text-[12px] font-medium text-status-danger hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
        <p className="border-t border-border px-5 py-3 font-mono text-[9.5px] uppercase tracking-wider text-ink-tertiary">
          Stored as extensionless UUIDv4
        </p>
      </aside>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename file"
        footer={
          <>
            <button type="button" onClick={() => setRenameOpen(false)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void handleRename()} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">Save</button>
          </>
        }
      >
        <input autoFocus maxLength={150} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="h-10 w-full rounded-md border border-border px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand-100" />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete file"
        description="This file and all of its share links will be permanently removed."
        footer={
          <>
            <button type="button" onClick={() => setDeleteOpen(false)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void handleDelete()} className="h-8 rounded-md bg-status-danger px-3 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-60">Delete permanently</button>
          </>
        }
      >
        <p className="break-all rounded-md border border-border bg-canvas px-3 py-2.5 text-[12px] text-ink-primary">{file.original_filename}</p>
      </Modal>
    </>
  )
}
