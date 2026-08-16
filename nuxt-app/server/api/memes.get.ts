import { RECENT_LIMIT } from '../utils/group'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const groupId = isValidId(query.group) ? query.group : undefined
  const limit = Math.min(Math.max(Number(query.limit) || 48, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  let filter: Record<string, unknown> = groupId ? { groupId } : {}
  let recent = false
  if (groupId) {
    const group = await GroupSchema.findById(groupId).select('isFavorites isRecent').lean()
    if (!group) {
      throw createError({ statusCode: 404, message: '分组不存在' })
    }
    if (group.isFavorites) {
      filter = { favorite: true }
    } else if (group.isRecent) {
      filter = { usedAt: { $ne: null } }
      recent = true
    }
  }

  const effectiveLimit = recent ? Math.max(0, Math.min(limit, RECENT_LIMIT - offset)) : limit

  const [docs, total] = await Promise.all([
    MemeSchema.find(filter)
      .sort(recent ? { usedAt: -1, createdAt: -1 } : { createdAt: -1 })
      .skip(offset)
      .limit(effectiveLimit)
      .lean(),
    MemeSchema.countDocuments(filter)
  ])

  return {
    items: docs.map(toMeme),
    total: recent ? Math.min(total, RECENT_LIMIT) : total,
    limit,
    offset
  }
})
