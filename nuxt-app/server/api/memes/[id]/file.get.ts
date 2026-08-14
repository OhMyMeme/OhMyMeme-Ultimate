export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findById(id).lean()
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: '表情不存在' })
  }

  const data = await storage.read(doc.storageKey)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: '文件不存在' })
  }

  setResponseHeader(event, 'content-type', doc.mimeType)
  setResponseHeader(event, 'content-length', data.byteLength)
  setResponseHeader(event, 'cache-control', 'private, max-age=31536000, immutable')

  return data
})
