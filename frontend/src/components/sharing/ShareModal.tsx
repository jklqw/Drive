import { useCallback, useEffect, useState } from 'react'
import { Check, Clipboard, Link2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { errorMessage } from '../../api/client'
import { sharesApi, type ShareOptions } from '../../api/shares'
import type { FileRecord, ShareLink } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/format'
import { Modal } from '../ui/Modal'

interface ShareModalProps {
  file: FileRecord | null
  onClose: () => void
  onChanged?: () => void
}

const expirations = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
  { label: 'No expiry', hours: null },
]

export function ShareModal({ file, onClose, onChanged }: ShareModalProps) {
  const { notify } = useToast()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [expiry, setExpiry] = useState<number | null>(24)
  const [maxDownloads, setMaxDownloads] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!file) return
    try {
      const all = await sharesApi.list()
      setLinks(all.filter((link) => link.file_id === file.id && !link.is_revoked))
    } catch (error) {
      notify(errorMessage(error, 'Unable to load share links'), 'error')
    }
  }, [file, notify])

  useEffect(() => {
    if (file) {
      setCreated(null)
      void load()
    }
  }, [file, load])

  async function handleCreate() {
    if (!file) return
    setBusy(true)
    try {
      const options: ShareOptions = {
        expires_in_hours: expiry,
        max_downloads: maxDownloads.trim() ? Number(maxDownloads) : null,
      }
      const share = await sharesApi.create(file.id, options)
      setCreated(`${window.location.origin}${share.url}`)
      notify('Share link created', 'success')
      await load()
      onChanged?.()
    } catch (error) {
      notify(errorMessage(error, 'Unable to create share link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!created) return
    await navigator.clipboard.writeText(created)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function handleRevoke(id: string) {
    setBusy(true)
    try {
      await sharesApi.revoke(id)
      notify('Link revoked', 'success')
      await load()
      onChanged?.()
    } catch (error) {
      notify(errorMessage(error, 'Unable to revoke link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={file !== null}
      onClose={onClose}
      title="Share file"
      description={file ? `Create an expiring, download-capped link for ${file.original_filename}.` : undefined}
      width="lg"
      footer={
        <button type="button" onClick={onClose} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">
          Done
        </button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">New link</p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-secondary">Expires after</span>
              <select
                value={expiry === null ? 'never' : String(expiry)}
                onChange={(event) => setExpiry(event.target.value === 'never' ? null : Number(event.target.value))}
                className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[12px] outline-none focus:border-brand"
              >
                {expirations.map((item) => (
                  <option key={item.label} value={item.hours === null ? 'never' : item.hours}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-secondary">Maximum downloads</span>
              <input
                type="number"
                min={1}
                max={100000}
                value={maxDownloads}
                onChange={(event) => setMaxDownloads(event.target.value)}
                placeholder="Unlimited"
                className="h-9 w-full rounded-md border border-border px-2.5 text-[12px] outline-none focus:border-brand"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreate()}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand text-[12px] font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Link2 size={14} /> Create link
            </button>
          </div>
          {created && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-status-success">Link ready</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly value={created} className="h-8 min-w-0 flex-1 rounded border border-border bg-surface px-2 font-mono text-[10px] text-ink-secondary" />
                <button type="button" onClick={() => void handleCopy()} title="Copy link" className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-surface text-ink-secondary hover:text-brand">
                  {copied ? <Check size={14} className="text-status-success" /> : <Clipboard size={14} />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-ink-tertiary">The secret is shown only once. Only its SHA-256 hash is stored.</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Active links ({links.length})</p>
          <div className="mt-3 space-y-2">
            {links.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-[11.5px] text-ink-tertiary">
                No active links for this file.
              </p>
            )}
            {links.map((link) => (
              <div key={link.id} className={clsx('rounded-md border border-border p-3', link.expires_at && new Date(link.expires_at) < new Date() && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-ink-secondary">{link.token_hash.slice(0, 12)}…</p>
                    <p className="mt-1 text-[11px] text-ink-primary">
                      {link.download_count}{link.max_downloads ? ` / ${link.max_downloads}` : ''} downloads
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-tertiary">
                      {link.expires_at ? `Expires ${formatDateTime(link.expires_at)}` : 'No expiry'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRevoke(link.id)}
                    title="Revoke link"
                    className="rounded p-1.5 text-ink-tertiary hover:bg-red-50 hover:text-status-danger disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
