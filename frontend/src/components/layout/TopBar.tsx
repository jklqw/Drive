import { ChevronRight, Grid2X2, Home, LayoutList, LockKeyhole, Search } from 'lucide-react'
import clsx from 'clsx'
import type { BreadcrumbItem } from '../../api/types'

interface TopBarProps {
  rootLabel?: string
  onRootNavigate?: () => void
  breadcrumbs: BreadcrumbItem[]
  onNavigate: (id: string | null) => void
  search: string
  onSearchChange: (value: string) => void
  view: 'grid' | 'list'
  onViewChange: (view: 'grid' | 'list') => void
}

export function TopBar({
  rootLabel = 'My Drive',
  onRootNavigate,
  breadcrumbs,
  onNavigate,
  search,
  onSearchChange,
  view,
  onViewChange,
}: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => (onRootNavigate ? onRootNavigate() : onNavigate(null))}
          className={clsx(
            'flex items-center gap-1.5 rounded px-1.5 py-1 text-[12.5px] transition-colors hover:bg-canvas',
            breadcrumbs.length === 0 ? 'font-medium text-ink-primary' : 'text-ink-secondary',
          )}
        >
          <Home size={14} /> {rootLabel}
        </button>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight size={13} className="shrink-0 text-ink-tertiary" />
            <button
              type="button"
              onClick={() => onNavigate(crumb.id)}
              className="truncate rounded px-1.5 py-1 text-[12.5px] text-ink-secondary transition-colors hover:bg-canvas hover:text-ink-primary"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="relative hidden sm:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search this folder"
            className="h-8 w-52 rounded-md border border-border bg-canvas pl-8 pr-3 text-[12px] outline-none transition-all placeholder:text-ink-tertiary focus:w-64 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <div className="flex items-center rounded-md border border-border p-0.5">
          {(['grid', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewChange(mode)}
              title={`${mode} view`}
              aria-label={`${mode} view`}
              className={clsx(
                'flex h-6 w-7 items-center justify-center rounded transition-colors',
                view === mode ? 'bg-canvas text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary',
              )}
            >
              {mode === 'grid' ? <Grid2X2 size={14} /> : <LayoutList size={14} />}
            </button>
          ))}
        </div>
        <span className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-tertiary lg:flex">
          <LockKeyhole size={12} className="text-status-success" /> Encrypted session
        </span>
      </div>
    </header>
  )
}
