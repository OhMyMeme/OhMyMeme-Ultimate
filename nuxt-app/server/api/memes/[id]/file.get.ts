export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findById(id).lean()
  if (!doc) {
    throw createError({ statusCode: 404, message: '表情不存在' })
  }

  const data = await storage.read(doc.storageKey)
  if (!data) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  setResponseHeader(event, 'content-type', doc.mimeType)
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'cache-control', 'private, max-age=31536000, immutable')

  const range = getHeader(event, 'range')
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (match) {
      const size = data.byteLength
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Number(match[2]) : size - 1
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && start < size) {
        const chunk = data.subarray(start, Math.min(end + 1, size))
        setResponseStatus(event, 206)
        setResponseHeader(event, 'content-range', `bytes ${start}-${start + chunk.byteLength - 1}/${size}`)
        setResponseHeader(event, 'content-length', chunk.byteLength)
        setResponseHeader(event, 'accept-ranges', 'bytes')
        return chunk
      }
    }
    setResponseHeader(event, 'content-range', `bytes */${data.byteLength}`)
    setResponseStatus(event, 416)
    return null
  }

  setResponseHeader(event, 'content-length', data.byteLength)
  setResponseHeader(event, 'accept-ranges', 'bytes')
  return data
})
