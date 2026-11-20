import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { ShieldAlert } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { errorMessage } from '../../api/client'
import type { AuditEntry } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/format'

const filters = [
  { label: 'ALL', value: '' },
  { label: 'UPLOAD_BLOCKED', value: 'UPLOAD_BLOCKED' },
  { label: 'ACCESS_DENIED', value: 'ACCESS_DENIED' },
  { label: 'SHARE_CREATED', value: 'SHARE_CREATED' },
]

export function AuditLogViewer() {
  const { notify } = useToast()
  const [filter, setFilter] = useState('')
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await adminApi.auditLogs({ action: filter || undefined, limit: 100 }))
    } catch (error) {
      notify(errorMessage(error, 'Unable to load audit log'), 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, notify])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-ink-primary">
          <ShieldAlert size={15} className="text-brand" /> Security event stream
        </p>
        <div className="flex gap-1">
          {filters.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setFilter(item.value)}
              className={clsx(
                'rounded px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider transition-colors',
                filter === item.value ? 'bg-ink-primary text-white' : 'text-ink-tertiary hover:bg-canvas hover:text-ink-primary',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {loading && <p className="px-4 py-10 text-center text-[11.5px] text-ink-tertiary">Loading events…</p>}
        {!loading && logs.length === 0 && <p className="px-4 py-10 text-center text-[11.5px] text-ink-tertiary">No matching events.</p>}
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-canvas/80 backdrop-blur">
            <tr className="font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Resource</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-canvas/40">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-[10px] text-ink-tertiary">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-2 font-mono text-[10px] font-medium text-ink-primary">{log.action}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-ink-secondary">{log.resource_type}{log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ''}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-ink-secondary">{log.ip_address ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={clsx(
                    'rounded px-1.5 py-0.5 font-mono text-[9px]',
                    log.status === 'SUCCESS' ? 'bg-emerald-50 text-status-success' : 'bg-red-50 text-status-danger',
                  )}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
