export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

export function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function fileKind(file: { extension: string; detected_mime_type: string }): 'image' | 'archive' | 'sheet' | 'document' | 'file' {
  if (file.detected_mime_type.startsWith('image/')) return 'image'
  if (['zip'].includes(file.extension)) return 'archive'
  if (['csv', 'xlsx'].includes(file.extension)) return 'sheet'
  if (['pdf', 'txt', 'docx', 'pptx'].includes(file.extension)) return 'document'
  return 'file'
}
