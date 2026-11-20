import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  note: string
  icon: ReactNode
  tone?: 'default' | 'warning' | 'danger'
}

export function KpiCard({ label, value, note, icon, tone = 'default' }: KpiCardProps) {
  const accent =
    tone === 'danger' ? 'text-status-danger bg-red-50' : tone === 'warning' ? 'text-status-warning bg-amber-50' : 'text-brand bg-brand-50'
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>{icon}</span>
      </div>
      <p className="mt-3 font-mono text-[24px] font-semibold tracking-tight text-ink-primary">{value}</p>
      <p className="mt-1 text-[11px] text-ink-secondary">{note}</p>
    </div>
  )
}
