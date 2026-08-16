import type { GroupRecord } from '../models/group.schema'

interface GroupLean extends GroupRecord {
  _id: unknown
  createdAt?: Date
}

export const FAVORITES_GROUP_NAME = '收藏'
export const RECENT_GROUP_NAME = '最近使用'
export const UNGROUPED_GROUP_NAME = '未分组'

export const SYSTEM_GROUP_NAMES = [FAVORITES_GROUP_NAME, RECENT_GROUP_NAME, UNGROUPED_GROUP_NAME]

export const RECENT_LIMIT = 50

type SystemGroupFlag = 'isFavorites' | 'isRecent' | 'isUngrouped'

const SYSTEM_GROUP_DEFS: Array<{ flag: SystemGroupFlag, name: string }> = [
  { flag: 'isFavorites', name: FAVORITES_GROUP_NAME },
  { flag: 'isRecent', name: RECENT_GROUP_NAME },
  { flag: 'isUngrouped', name: UNGROUPED_GROUP_NAME }
]

export async function ensureSystemGroups() {
  await Promise.all(SYSTEM_GROUP_DEFS.map(async ({ flag, name }) => {
    const existing = await GroupSchema.findOne({ [flag]: true }).lean()
    if (existing) {
      return existing
    }
    try {
      return await GroupSchema.findOneAndUpdate(
        { [flag]: true },
        { $setOnInsert: { name, [flag]: true } },
        { upsert: true, returnDocument: 'after' }
      ).lean()
    } catch {
      return GroupSchema.findOne({ [flag]: true }).lean()
    }
  }))
}

export async function getUngroupedGroup() {
  await ensureSystemGroups()
  return GroupSchema.findOne({ isUngrouped: true }).lean()
}

export function isSystemGroup(group?: { isFavorites?: boolean, isRecent?: boolean, isUngrouped?: boolean } | null): boolean {
  return Boolean(group && (group.isFavorites || group.isRecent || group.isUngrouped))
}

export function groupOrderRank(group: GroupLean): number {
  if (group.isFavorites) {
    return 0
  }
  if (group.isRecent) {
    return 1
  }
  if (group.isUngrouped) {
    return 2
  }
  return 3
}

export interface GroupDto {
  id: string
  name: string
  isFavorites: boolean
  isRecent: boolean
  isUngrouped: boolean
  count: number
  covers: string[]
}

export function toGroup(doc: GroupLean, count = 0, coverKeys: unknown[] = []): GroupDto {
  return {
    id: String(doc._id),
    name: doc.name,
    isFavorites: Boolean(doc.isFavorites),
    isRecent: Boolean(doc.isRecent),
    isUngrouped: Boolean(doc.isUngrouped),
    count,
    covers: coverKeys.map(key => `/api/memes/${String(key)}/thumb`)
  }
}

export async function getGroupCount(id: string): Promise<number> {
  return MemeSchema.countDocuments({ groupId: id })
}
