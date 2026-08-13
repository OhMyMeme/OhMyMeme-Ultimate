export interface Stat {
  title: string
  icon: string
  value: number | string
}

export interface MemeGroup {
  id: string
  name: string
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
  createdAt?: string
}

export interface MemeListResponse {
  items: Meme[]
  total: number
  limit: number
  offset: number
}
