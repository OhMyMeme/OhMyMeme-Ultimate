export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findByIdAndUpdate(id, { usedAt: new Date() }, { returnDocument: 'after' }).lean()
  if (!doc) {
    throw createError({ statusCode: 404, message: '表情不存在' })
  }

  broadcastRealtime('memes-changed', { groupId: String(doc.groupId) })
  return toMeme(doc)
})
