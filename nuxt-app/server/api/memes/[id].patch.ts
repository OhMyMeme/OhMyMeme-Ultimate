export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const body = await readBody<{ name?: string, groupId?: string, favorite?: boolean }>(event)

  const update: { name?: string, groupId?: string, favorite?: boolean } = {}
  if (typeof body?.name === 'string' && body.name.trim()) {
    update.name = body.name.trim()
  }
  if (typeof body?.groupId === 'string') {
    requireValidId(body.groupId, '无效的分组')
    const group = await GroupSchema.findById(body.groupId)
    if (!group) {
      throw createError({ statusCode: 404, message: '分组不存在' })
    }
    if (group.isFavorites) {
      throw createError({ statusCode: 400, message: '不能移动到收藏分组' })
    }
    if (group.isRecent) {
      throw createError({ statusCode: 400, message: '不能移动到最近使用分组' })
    }
    update.groupId = body.groupId
  }
  if (typeof body?.favorite === 'boolean') {
    update.favorite = body.favorite
  }

  if (!Object.keys(update).length) {
    throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  }

  const doc = await MemeSchema.findByIdAndUpdate(id, update, { returnDocument: 'after' }).lean()
  if (!doc) {
    throw createError({ statusCode: 404, message: '表情不存在' })
  }

  broadcastRealtime('memes-changed', { groupId: String(doc.groupId) })
  return toMeme(doc)
})
