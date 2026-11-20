export type Role = 'user' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  storage_quota_bytes: number
  storage_used_bytes: number
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface BreadcrumbItem {
  id: string | null
  name: string
}

export interface Folder {
  id: string
  name: string
  owner_id: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface FileRecord {
  id: string
  owner_id: string
  folder_id: string | null
  original_filename: string
  detected_mime_type: string
  extension: string
  size_bytes: number
  sha256_hash: string
  created_at: string
  updated_at: string
}

export interface ContentsResponse {
  folders: Folder[]
  files: FileRecord[]
  breadcrumbs: BreadcrumbItem[]
}

export interface ShareLink {
  id: string
  file_id: string
  created_by: string
  token_hash: string
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  is_revoked: boolean
  created_at: string
  filename?: string
}

export interface CreateShareResponse extends ShareLink {
  token: string
  url: string
}

export interface PublicShareInfo {
  filename: string
  size_bytes: number
  detected_mime_type: string
  sha256_hash: string
  expires_at: string | null
  download_count: number
  max_downloads: number | null
}

export interface AdminOverview {
  total_users: number
  active_users: number
  total_files: number
  total_folders: number
  total_storage_bytes: number
  blocked_uploads_24h: number
  access_denied_24h: number
}

export interface AdminUser extends User {
  file_count: number
}

export interface AuditEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  status: string
  details: Record<string, unknown>
  created_at: string
}
