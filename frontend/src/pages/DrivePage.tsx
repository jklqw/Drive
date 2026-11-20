import { useCallback, useRef, useState } from 'react'
import { DragDropOverlay } from '../components/files/DragDropOverlay'
import { FileExplorer } from '../components/files/FileExplorer'
import { FileInspectorDrawer } from '../components/files/FileInspectorDrawer'
import { useUploader } from '../components/files/useUploader'
import { DriveLayout } from '../components/layout/DriveLayout'
import type { BreadcrumbItem, FileRecord } from '../api/types'

export function DrivePage() {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [refreshKey, setRefreshKey] = useState(0)
  const [inspected, setInspected] = useState<FileRecord | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const onChanged = useCallback(() => setRefreshKey((value) => value + 1), [])
  const uploader = useUploader(folderId, onChanged)
  const onFiles = useCallback((files: File[]) => void uploader.enqueue(files), [uploader])

  return (
    <DriveLayout
      breadcrumbs={breadcrumbs}
      onNavigate={setFolderId}
      search={search}
      onSearchChange={setSearch}
      view={view}
      onViewChange={setView}
      onUpload={() => fileInput.current?.click()}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <FileExplorer
            folderId={folderId}
            onNavigate={setFolderId}
            onBreadcrumbs={setBreadcrumbs}
            refreshKey={refreshKey}
            onChanged={onChanged}
            view={view}
            search={search}
            onInspect={setInspected}
            onShare={() => {}}
          />
        </div>
        <FileInspectorDrawer
          file={inspected}
          onClose={() => setInspected(null)}
          onShare={() => {}}
          onChanged={onChanged}
        />
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <DragDropOverlay items={uploader.items} active={uploader.active} onFiles={onFiles} onClear={uploader.clear} />
    </DriveLayout>
  )
}
