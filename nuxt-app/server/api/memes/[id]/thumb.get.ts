export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findById(id).lean()
  if (!doc) {
    throw createError({ statusCode: 404, message: '表情不存在' })
  }

  const key = doc.thumbKey || doc.storageKey
  const data = await storage.read(key)
  if (!data) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  setResponseHeader(event, 'content-type', doc.thumbKey ? 'image/webp' : doc.mimeType)
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'content-length', data.byteLength)
  setResponseHeader(event, 'cache-control', 'private, max-age=31536000, immutable')

  return data
})
