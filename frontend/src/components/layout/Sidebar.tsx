import { NavLink, useNavigate } from 'react-router-dom'
import {
  Clock3,
  FolderClosed,
  FolderLock,
  Link2,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { StorageMeter } from './StorageMeter'

interface SidebarProps {
  onUpload?: () => void
}

const soon = [
  { label: 'Shared Links', icon: Link2 },
  { label: 'Recent', icon: Clock3 },
  { label: 'Trash', icon: Trash2 },
]

export function Sidebar({ onUpload }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-primary text-white">
          <FolderLock size={15} />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight text-ink-primary">sfmp<span className="text-ink-tertiary">/vault</span></p>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-tertiary">Private workspace</p>
        </div>
      </div>

      {onUpload && (
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onUpload}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand text-[12px] font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Plus size={15} strokeWidth={2.3} /> Upload files
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3">
        <NavLink
          to="/drive"
          end
          className={({ isActive }) =>
            clsx(
              'flex h-9 items-center gap-2.5 rounded-md px-3 text-[12.5px] font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-secondary hover:bg-canvas hover:text-ink-primary',
            )
          }
        >
          <FolderClosed size={16} /> My Drive
        </NavLink>
        {soon.map(({ label, icon: Icon }) => (
          <div
            key={label}
            title="Coming soon"
            className="flex h-9 items-center gap-2.5 rounded-md px-3 text-[12.5px] text-ink-tertiary"
          >
            <Icon size={16} /> {label}
          </div>
        ))}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              clsx(
                'mt-4 flex h-9 items-center gap-2.5 rounded-md px-3 text-[12.5px] font-medium transition-colors',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-secondary hover:bg-canvas hover:text-ink-primary',
              )
            }
          >
            <ShieldCheck size={16} /> Admin Console
          </NavLink>
        )}
      </nav>

      {user && <StorageMeter used={user.storage_used_bytes} quota={user.storage_quota_bytes} />}

      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold text-ink-primary">
          {user?.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'SF'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-ink-primary">{user?.full_name}</p>
          <p className="truncate font-mono text-[9.5px] text-ink-tertiary">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="rounded p-1.5 text-ink-tertiary transition-colors hover:bg-canvas hover:text-status-danger"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}
