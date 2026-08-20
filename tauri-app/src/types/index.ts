export interface Stat {
  title: string
  icon: string
  value: number | string
}

export interface MemeGroup {
  id: string
  name: string
  isFavorites: boolean
  isRecent: boolean
  isUngrouped: boolean
  count: number
  covers: string[]
}

export interface Meme {
  id: string
  name: string
  groupId: string
  tags: string[]
  mimeType: string
  size: number
  url: string
  thumbUrl?: string
  favorite: boolean
  createdAt?: string
  sortOrder?: number | null
}

export interface MemeListResponse {
  items: Meme[]
  total: number
  limit: number
  offset: number
}

export interface Tag {
  name: string
  count: number
}

export interface Overview {
  memeCount: number
  favoriteCount: number
  groupCount: number
  storageBytes: number
}