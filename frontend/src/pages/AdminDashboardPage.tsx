import { useCallback, useEffect, useState } from 'react'
import { AlertOctagon, Database, Files, Users } from 'lucide-react'
import { adminApi } from '../api/admin'
import { errorMessage } from '../api/client'
import type { AdminOverview, AdminUser } from '../api/types'
import { AuditLogViewer } from '../components/admin/AuditLogViewer'
import { KpiCard } from '../components/admin/KpiCard'
import { UsersTable } from '../components/admin/UsersTable'
import { DriveLayout } from '../components/layout/DriveLayout'
import { useToast } from '../context/ToastContext'
import { formatBytes } from '../lib/format'

export function AdminDashboardPage() {
  const { notify } = useToast()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('list')

  const load = useCallback(async () => {
    try {
      const [summary, accounts] = await Promise.all([adminApi.overview(), adminApi.users()])
      setOverview(summary)
      setUsers(accounts)
    } catch (error) {
      notify(errorMessage(error, 'Unable to load admin telemetry'), 'error')
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DriveLayout
      rootLabel="Admin Console"
      breadcrumbs={[]}
      onNavigate={() => {}}
      search={search}
      onSearchChange={setSearch}
      view={view}
      onViewChange={setView}
    >
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <div className="mb-5">
          <h1 className="text-[18px] font-semibold tracking-tight text-ink-primary">Workspace overview</h1>
          <p className="mt-1 text-[12px] text-ink-secondary">Storage telemetry, account controls, and security events across all tenants.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total storage"
            value={formatBytes(overview?.total_storage_bytes ?? 0)}
            note={`${overview?.total_files ?? 0} stored objects`}
            icon={<Database size={15} />}
          />
          <KpiCard
            label="Accounts"
            value={String(overview?.total_users ?? 0)}
            note={`${overview?.active_users ?? 0} active`}
            icon={<Users size={15} />}
          />
          <KpiCard
            label="Objects"
            value={String((overview?.total_files ?? 0) + (overview?.total_folders ?? 0))}
            note={`${overview?.total_folders ?? 0} folders`}
            icon={<Files size={15} />}
          />
          <KpiCard
            label="Security events"
            value={String((overview?.blocked_uploads_24h ?? 0) + (overview?.access_denied_24h ?? 0))}
            note="Last 24 hours"
            icon={<AlertOctagon size={15} />}
            tone={(overview?.blocked_uploads_24h ?? 0) > 0 ? 'danger' : 'warning'}
          />
        </div>

        <section className="mt-7">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-primary">User management</h2>
          <UsersTable users={users} onChange={() => void load()} />
        </section>

        <section className="mt-7 pb-10">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-primary">Audit trail</h2>
          <AuditLogViewer />
        </section>
      </div>
    </DriveLayout>
  )
}
