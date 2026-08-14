export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const body = await readBody<{ name?: string, groupId?: string }>(event)

  const update: { name?: string, groupId?: string } = {}
  if (typeof body?.name === 'string' && body.name.trim()) {
    update.name = body.name.trim()
  }
  if (typeof body?.groupId === 'string') {
    requireValidId(body.groupId, '无效的分组')
    const group = await GroupSchema.findById(body.groupId)
    if (!group) {
      throw createError({ statusCode: 404, statusMessage: '分组不存在' })
    }
    update.groupId = body.groupId
  }

  if (!Object.keys(update).length) {
    throw createError({ statusCode: 400, statusMessage: '没有需要更新的字段' })
  }

  const doc = await MemeSchema.findByIdAndUpdate(id, update, { new: true }).lean()
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: '表情不存在' })
  }

  return toMeme(doc)
})
