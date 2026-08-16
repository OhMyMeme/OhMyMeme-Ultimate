export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findByIdAndDelete(id)
  if (!doc) {
    throw createError({ statusCode: 404, message: '表情不存在' })
  }

  await storage.remove(doc.storageKey)
  if (doc.thumbKey) {
    await storage.remove(doc.thumbKey)
  }
  broadcastRealtime('memes-changed', { groupId: String(doc.groupId) })

  return { ok: true }
})
