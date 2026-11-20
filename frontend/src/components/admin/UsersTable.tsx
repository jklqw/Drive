import { useState } from 'react'
import { Ban, CheckCircle2, Pencil } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { errorMessage } from '../../api/client'
import type { AdminUser } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { formatBytes, formatDate } from '../../lib/format'
import { Modal } from '../ui/Modal'

interface UsersTableProps {
  users: AdminUser[]
  onChange: () => void
}

export function UsersTable({ users, onChange }: UsersTableProps) {
  const { notify } = useToast()
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [quotaGb, setQuotaGb] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveQuota() {
    if (!editing) return
    const gb = Number(quotaGb)
    if (!Number.isFinite(gb) || gb <= 0) {
      notify('Enter a positive quota', 'error')
      return
    }
    setBusy(true)
    try {
      await adminApi.updateUser(editing.id, { storage_quota_bytes: Math.round(gb * 1024 * 1024 * 1024) })
      notify('Quota updated', 'success')
      setEditing(null)
      onChange()
    } catch (error) {
      notify(errorMessage(error, 'Unable to update quota'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(user: AdminUser) {
    setBusy(true)
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active })
      notify(user.is_active ? 'Account suspended' : 'Account reactivated', 'success')
      onChange()
    } catch (error) {
      notify(errorMessage(error, 'Unable to update account'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border bg-canvas/60 font-mono text-[9.5px] uppercase tracking-wider text-ink-tertiary">
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Usage</th>
              <th className="px-4 py-2.5 font-medium">Quota</th>
              <th className="px-4 py-2.5 font-medium">Files</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="w-28 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-canvas/40">
                <td className="px-4 py-3">
                  <p className="text-[12.5px] font-medium text-ink-primary">{user.full_name}</p>
                  <p className="font-mono text-[10px] text-ink-tertiary">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-[11.5px] text-ink-secondary">{user.role}</td>
                <td className="px-4 py-3 font-mono text-[10.5px] text-ink-secondary">{formatBytes(user.storage_used_bytes)}</td>
                <td className="px-4 py-3 font-mono text-[10.5px] text-ink-primary">{formatBytes(user.storage_quota_bytes)}</td>
                <td className="px-4 py-3 font-mono text-[10.5px] text-ink-secondary">{user.file_count}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${user.is_active ? 'bg-emerald-50 text-status-success' : 'bg-red-50 text-status-danger'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-status-success' : 'bg-status-danger'}`} />
                    {user.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Edit quota"
                      disabled={busy}
                      onClick={() => { setEditing(user); setQuotaGb((user.storage_quota_bytes / 1024 ** 3).toFixed(1)) }}
                      className="rounded p-1.5 text-ink-tertiary hover:bg-canvas hover:text-brand"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title={user.is_active ? 'Suspend account' : 'Reactivate account'}
                      disabled={busy}
                      onClick={() => void toggleStatus(user)}
                      className={`rounded p-1.5 hover:bg-canvas ${user.is_active ? 'text-ink-tertiary hover:text-status-danger' : 'text-status-success'}`}
                    >
                      {user.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit storage quota"
        description={editing ? `${editing.full_name} · currently using ${formatBytes(editing.storage_used_bytes)}` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void saveQuota()} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">Save quota</button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium">Quota in GB</span>
          <input type="number" min={0.1} step={0.1} value={quotaGb} onChange={(event) => setQuotaGb(event.target.value)} className="h-10 w-full rounded-md border border-border px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand-100" />
        </label>
        {editing && <p className="mt-2 font-mono text-[10px] text-ink-tertiary">Account created {formatDate(editing.created_at)}</p>}
      </Modal>
    </>
  )
}
