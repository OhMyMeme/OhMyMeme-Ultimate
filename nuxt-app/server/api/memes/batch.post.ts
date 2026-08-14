export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: unknown, action?: string, groupId?: string }>(event)

  const rawIds = Array.isArray(body?.ids) ? body.ids : []
  const ids = rawIds.filter(isValidId)
  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: '未选择表情' })
  }

  if (body?.action === 'move') {
    const groupId = requireValidId(body?.groupId, '无效的分组')
    const group = await GroupSchema.findById(groupId)
    if (!group) {
      throw createError({ statusCode: 404, statusMessage: '分组不存在' })
    }

    const result = await MemeSchema.updateMany({ _id: { $in: ids } }, { $set: { groupId } })
    broadcastRealtime('memes-changed', { groupId: String(groupId) })
    return { moved: result.modifiedCount }
  }

  if (body?.action === 'delete') {
    const memes = await MemeSchema.find({ _id: { $in: ids } }).select('storageKey').lean()
    const result = await MemeSchema.deleteMany({ _id: { $in: ids } })
    await Promise.allSettled(memes.map(meme => storage.remove(meme.storageKey)))
    broadcastRealtime('memes-changed')
    return { deleted: result.deletedCount }
  }

  throw createError({ statusCode: 400, statusMessage: '无效的操作' })
})
