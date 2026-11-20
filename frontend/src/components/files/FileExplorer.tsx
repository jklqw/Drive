import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import { filesApi } from '../../api/files'
import { foldersApi } from '../../api/folders'
import { errorMessage } from '../../api/client'
import type { BreadcrumbItem, FileRecord, Folder } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { fileKind, formatBytes, formatDate } from '../../lib/format'
import { Modal } from '../ui/Modal'
import { FileContextMenu } from './FileContextMenu'

type Target =
  | { kind: 'file'; item: FileRecord }
  | { kind: 'folder'; item: Folder }

interface FileExplorerProps {
  folderId: string | null
  onNavigate: (id: string | null) => void
  onBreadcrumbs: (items: BreadcrumbItem[]) => void
  refreshKey: number
  onChanged: () => void
  view: 'grid' | 'list'
  search: string
  onInspect: (file: FileRecord | null) => void
  onShare: (file: FileRecord) => void
}

const kindIcons = {
  image: FileImage,
  archive: FileArchive,
  sheet: FileSpreadsheet,
  document: FileText,
  file: FileIcon,
}

export function FileExplorer({
  folderId,
  onNavigate,
  onBreadcrumbs,
  refreshKey,
  onChanged,
  view,
  search,
  onInspect,
  onShare,
}: FileExplorerProps) {
  const { notify } = useToast()
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<{ file: FileRecord; x: number; y: number } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameTarget, setRenameTarget] = useState<Target | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const contents = await foldersApi.contents(folderId)
      setFolders(contents.folders)
      setFiles(contents.files)
      onBreadcrumbs(contents.breadcrumbs)
    } catch (error) {
      notify(errorMessage(error, 'Unable to load this folder'), 'error')
    } finally {
      setLoading(false)
    }
  }, [folderId, notify, onBreadcrumbs, refreshKey])

  useEffect(() => {
    void load()
  }, [load])

  const needle = search.trim().toLowerCase()
  const visibleFolders = useMemo(
    () => folders.filter((folder) => folder.name.toLowerCase().includes(needle)),
    [folders, needle],
  )
  const visibleFiles = useMemo(
    () => files.filter((file) => file.original_filename.toLowerCase().includes(needle)),
    [files, needle],
  )

  async function handleCreate() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await foldersApi.create(newName.trim(), folderId)
      notify('Folder created', 'success')
      setCreateOpen(false)
      setNewName('')
      onChanged()
    } catch (error) {
      notify(errorMessage(error, 'Unable to create folder'), 'error')
    } finally {
      setBusy(false)
    }
  }

  function openRename(target: Target) {
    setRenameTarget(target)
    setRenameValue(target.kind === 'file' ? target.item.original_filename : target.item.name)
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    setBusy(true)
    try {
      if (renameTarget.kind === 'file') {
        await filesApi.rename(renameTarget.item.id, renameValue.trim())
      } else {
        await foldersApi.rename(renameTarget.item.id, renameValue.trim())
      }
      notify('Renamed', 'success')
      setRenameTarget(null)
      onChanged()
    } catch (error) {
      notify(errorMessage(error, 'Unable to rename'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      if (deleteTarget.kind === 'file') {
        await filesApi.remove(deleteTarget.item.id)
      } else {
        await foldersApi.remove(deleteTarget.item.id)
      }
      notify('Deleted', 'success')
      setDeleteTarget(null)
      onInspect(null)
      onChanged()
    } catch (error) {
      notify(errorMessage(error, 'Unable to delete'), 'error')
    } finally {
      setBusy(false)
    }
  }

  function download(file: FileRecord) {
    void filesApi.download(file).catch(() => notify('Download failed', 'error'))
  }

  const empty = !loading && visibleFolders.length === 0 && visibleFiles.length === 0

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-ink-primary">
            {folderId ? 'Folder' : 'My Drive'}
          </h1>
          <p className="mt-0.5 font-mono text-[10.5px] text-ink-tertiary">
            {folders.length} folders · {files.length} files
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-ink-primary hover:bg-canvas"
        >
          <FolderPlus size={14} /> New folder
        </button>
      </div>

      {loading && <p className="py-16 text-center text-[12px] text-ink-tertiary">Loading contents…</p>}
      {empty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface py-20 text-center">
          <FolderIcon size={22} className="text-ink-tertiary" />
          <p className="mt-3 text-[13px] font-medium text-ink-primary">Nothing here yet</p>
          <p className="mt-1 text-[12px] text-ink-secondary">Drop files anywhere or create a folder to begin.</p>
        </div>
      )}

      {!loading && view === 'grid' && (visibleFolders.length > 0 || visibleFiles.length > 0) && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-3">
          {visibleFolders.map((folder) => (
            <div
              key={folder.id}
              onDoubleClick={() => onNavigate(folder.id)}
              className="group relative flex cursor-pointer flex-col rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand-500"
            >
              <FolderIcon size={22} className="text-brand" fill="currentColor" fillOpacity={0.12} />
              <p className="mt-4 truncate text-[12.5px] font-medium text-ink-primary" title={folder.name}>{folder.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-tertiary">{formatDate(folder.created_at)}</p>
              <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" aria-label="Rename folder" onClick={() => openRename({ kind: 'folder', item: folder })} className="rounded p-1 text-ink-tertiary hover:bg-canvas hover:text-ink-primary"><Pencil size={13} /></button>
                <button type="button" aria-label="Delete folder" onClick={() => setDeleteTarget({ kind: 'folder', item: folder })} className="rounded p-1 text-ink-tertiary hover:bg-red-50 hover:text-status-danger"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {visibleFiles.map((file) => {
            const Icon = kindIcons[fileKind(file)]
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onInspect(file)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setContext({ file, x: event.clientX, y: event.clientY })
                }}
                className="group flex flex-col rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-brand-500"
              >
                <span className="flex items-center justify-between">
                  <Icon size={22} className="text-ink-secondary" />
                  <MoreHorizontal
                    size={15}
                    className="text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      const rect = (event.currentTarget as unknown as HTMLElement).getBoundingClientRect()
                      setContext({ file, x: rect.left, y: rect.bottom })
                    }}
                  />
                </span>
                <span className="mt-4 block truncate text-[12.5px] font-medium text-ink-primary" title={file.original_filename}>{file.original_filename}</span>
                <span className="mt-0.5 font-mono text-[10px] text-ink-tertiary">{formatBytes(file.size_bytes)}</span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && view === 'list' && (visibleFolders.length > 0 || visibleFiles.length > 0) && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-canvas/60 font-mono text-[9.5px] uppercase tracking-wider text-ink-tertiary">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
                <th className="w-16 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleFolders.map((folder) => (
                <tr key={folder.id} className="cursor-pointer hover:bg-canvas/60" onDoubleClick={() => onNavigate(folder.id)}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5 text-[12.5px] text-ink-primary">
                      <FolderIcon size={15} className="text-brand" /> {folder.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink-tertiary">—</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-secondary">Folder</td>
                  <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink-tertiary">{formatDate(folder.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex gap-1">
                      <button type="button" aria-label="Rename folder" onClick={() => openRename({ kind: 'folder', item: folder })} className="rounded p-1 text-ink-tertiary hover:bg-canvas hover:text-ink-primary"><Pencil size={13} /></button>
                      <button type="button" aria-label="Delete folder" onClick={() => setDeleteTarget({ kind: 'folder', item: folder })} className="rounded p-1 text-ink-tertiary hover:bg-red-50 hover:text-status-danger"><Trash2 size={13} /></button>
                    </span>
                  </td>
                </tr>
              ))}
              {visibleFiles.map((file) => {
                const Icon = kindIcons[fileKind(file)]
                return (
                  <tr key={file.id} className="cursor-pointer hover:bg-canvas/60" onClick={() => onInspect(file)}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5 text-[12.5px] text-ink-primary">
                        <Icon size={15} className="text-ink-secondary" /> {file.original_filename}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink-tertiary">{formatBytes(file.size_bytes)}</td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink-secondary">{file.detected_mime_type}</td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink-tertiary">{formatDate(file.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        aria-label="File actions"
                        onClick={(event) => {
                          event.stopPropagation()
                          const rect = (event.currentTarget as unknown as HTMLElement).getBoundingClientRect()
                          setContext({ file, x: rect.left - 140, y: rect.bottom })
                        }}
                        className="rounded p-1 text-ink-tertiary hover:bg-canvas hover:text-ink-primary"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {context && (
        <FileContextMenu
          file={context.file}
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          onDownload={download}
          onShare={onShare}
          onRename={(file) => openRename({ kind: 'file', item: file })}
          onDelete={(file) => setDeleteTarget({ kind: 'file', item: file })}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New folder"
        description="Folders are logical only — no user input is used in storage paths."
        footer={
          <>
            <button type="button" onClick={() => setCreateOpen(false)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void handleCreate()} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">Create</button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium">Folder name</span>
          <input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleCreate() }} placeholder="Q4 Reports" className="h-10 w-full rounded-md border border-border px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand-100" />
        </label>
      </Modal>

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename"
        footer={
          <>
            <button type="button" onClick={() => setRenameTarget(null)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void handleRename()} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">Save</button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium">New name</span>
          <input autoFocus value={renameValue} maxLength={150} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleRename() }} className="h-10 w-full rounded-md border border-border px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand-100" />
        </label>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.kind === 'folder' ? 'Delete folder' : 'Delete file'}
        description={deleteTarget?.kind === 'folder' ? 'All files inside this folder will be permanently removed.' : 'This file and its share links will be permanently removed.'}
        footer={
          <>
            <button type="button" onClick={() => setDeleteTarget(null)} className="h-8 rounded-md border border-border px-3 text-[12px] text-ink-secondary hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void handleDelete()} className={clsx('h-8 rounded-md bg-status-danger px-3 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-60')}>Delete permanently</button>
          </>
        }
      >
        <p className="break-all rounded-md border border-border bg-canvas px-3 py-2.5 text-[12px] text-ink-primary">
          {deleteTarget?.kind === 'file' ? deleteTarget.item.original_filename : deleteTarget?.item.name}
        </p>
      </Modal>
    </div>
  )
}
