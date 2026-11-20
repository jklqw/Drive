import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Download, FileLock2, ShieldCheck } from 'lucide-react'
import { errorMessage } from '../api/client'
import { saveBlob } from '../api/files'
import { sharesApi } from '../api/shares'
import type { PublicShareInfo } from '../api/types'
import { useToast } from '../context/ToastContext'
import { formatBytes, formatDate, shortHash } from '../lib/format'

export function PublicSharePage() {
  const { token = '' } = useParams()
  const { notify } = useToast()
  const [info, setInfo] = useState<PublicShareInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInfo(await sharesApi.publicInfo(token))
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'This link cannot be opened'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDownload() {
    if (!info) return
    setDownloading(true)
    try {
      const blob = await sharesApi.publicDownload(token)
      saveBlob(blob, info.filename)
      notify('Download started', 'success')
      void load()
    } catch (err) {
      notify(errorMessage(err, 'Download failed'), 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-primary text-white"><FileLock2 size={16} /></span>
          <span className="text-[14px] font-semibold tracking-tight">sfmp<span className="text-ink-tertiary">/vault</span></span>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-surface p-7 shadow-sm">
          {loading && <p className="py-12 text-center text-[12px] text-ink-tertiary">Verifying link…</p>}
          {error && !loading && (
            <div className="flex flex-col items-center py-12 text-center">
              <AlertCircle size={24} className="text-status-danger" />
              <p className="mt-4 text-[15px] font-semibold text-ink-primary">Link unavailable</p>
              <p className="mt-1.5 max-w-xs text-[12px] leading-5 text-ink-secondary">{error}. It may have expired, reached its download cap, or been revoked by its owner.</p>
            </div>
          )}
          {info && !loading && (
            <>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <FileLock2 size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="break-all text-[18px] font-semibold leading-snug tracking-tight text-ink-primary">{info.filename}</h1>
                  <p className="mt-1 font-mono text-[11px] text-ink-secondary">{formatBytes(info.size_bytes)} · {info.detected_mime_type}</p>
                </div>
              </div>
              <div className="mt-6 divide-y divide-border border-y border-border">
                <div className="flex justify-between gap-3 py-2.5 text-[12px]">
                  <span className="text-ink-secondary">SHA-256 checksum</span>
                  <span className="break-all text-right font-mono text-[10.5px] text-ink-primary">{shortHash(info.sha256_hash)}</span>
                </div>
                <div className="flex justify-between gap-3 py-2.5 text-[12px]">
                  <span className="text-ink-secondary">Downloads</span>
                  <span className="font-mono text-[11px] text-ink-primary">
                    {info.download_count}{info.max_downloads ? ` / ${info.max_downloads}` : ' / unlimited'}
                  </span>
                </div>
                <div className="flex justify-between gap-3 py-2.5 text-[12px]">
                  <span className="text-ink-secondary">Expires</span>
                  <span className="font-mono text-[11px] text-ink-primary">
                    {info.expires_at ? formatDate(info.expires_at) : 'Never'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={downloading}
                onClick={() => void handleDownload()}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-[13px] font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Download size={16} /> {downloading ? 'Preparing download…' : 'Download file'}
              </button>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-tertiary">
                <ShieldCheck size={13} className="text-status-success" /> Content verified · safe attachment download
              </p>
            </>
          )}
        </div>
        <p className="mt-6 text-center font-mono text-[9.5px] uppercase tracking-wider text-ink-tertiary">
          Shared securely through Secure File Management Platform
        </p>
      </div>
    </main>
  )
}
