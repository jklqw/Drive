import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { DriveLayout } from '../components/layout/DriveLayout'

export function DrivePage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  return (
    <DriveLayout
      breadcrumbs={[]}
      onNavigate={() => {}}
      search={search}
      onSearchChange={setSearch}
      view={view}
      onViewChange={setView}
      onUpload={() => {}}
    >
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface text-ink-tertiary">
          <FolderOpen size={20} />
        </span>
        <p className="mt-4 text-[14px] font-medium text-ink-primary">Your workspace is ready</p>
        <p className="mt-1 max-w-sm text-[12px] leading-5 text-ink-secondary">
          Upload a file or create a folder to start organizing your private drive.
        </p>
      </div>
    </DriveLayout>
  )
}
