export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findByIdAndDelete(id)
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: '表情不存在' })
  }

  await storage.remove(doc.storageKey)
  broadcastRealtime('memes-changed', { groupId: String(doc.groupId) })

  return { ok: true }
})
