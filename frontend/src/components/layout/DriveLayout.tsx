import type { ReactNode } from 'react'
import type { BreadcrumbItem } from '../../api/types'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface DriveLayoutProps {
  children: ReactNode
  breadcrumbs: BreadcrumbItem[]
  onNavigate: (id: string | null) => void
  search: string
  onSearchChange: (value: string) => void
  view: 'grid' | 'list'
  onViewChange: (view: 'grid' | 'list') => void
  onUpload: () => void
}

export function DriveLayout({
  children,
  breadcrumbs,
  onNavigate,
  search,
  onSearchChange,
  view,
  onViewChange,
  onUpload,
}: DriveLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar onUpload={onUpload} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumbs={breadcrumbs}
          onNavigate={onNavigate}
          search={search}
          onSearchChange={onSearchChange}
          view={view}
          onViewChange={onViewChange}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
