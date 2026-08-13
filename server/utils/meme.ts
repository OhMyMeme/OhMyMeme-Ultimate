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
    createdAt: doc.createdAt
  }
}
