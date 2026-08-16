import type { MemeRecord } from '../models/meme.schema'

interface MemeLean extends Omit<MemeRecord, 'groupId'> {
  _id: unknown
  groupId: unknown
  createdAt?: Date
}

export interface MemeDto {
  id: string
  name: string
  groupId: string
  tags: string[]
  mimeType: string
  size: number
  url: string
  thumbUrl: string
  favorite: boolean
  createdAt?: Date
}

export function toMeme(doc: MemeLean): MemeDto {
  return {
    id: String(doc._id),
    name: doc.name,
    groupId: String(doc.groupId),
    tags: doc.tags,
    mimeType: doc.mimeType,
    size: doc.size,
    url: `/api/memes/${doc._id}/file`,
    thumbUrl: `/api/memes/${doc._id}/thumb`,
    favorite: Boolean(doc.favorite),
    createdAt: doc.createdAt
  }
}
