import type { GroupRecord } from '../models/group.schema'

interface GroupLean extends GroupRecord {
  _id: unknown
}

export interface GroupDto {
  id: string
  name: string
  count: number
  covers: string[]
}

export function toGroup(doc: GroupLean, count = 0, coverKeys: unknown[] = []): GroupDto {
  return {
    id: String(doc._id),
    name: doc.name,
    count,
    covers: coverKeys.map(key => `/api/memes/${String(key)}/file`)
  }
}

export async function getGroupCount(id: string): Promise<number> {
  return MemeSchema.countDocuments({ groupId: id })
}
