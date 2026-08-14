export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const doc = await MemeSchema.findById(id).lean()
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: '表情不存在' })
  }

  return toMeme(doc)
})
