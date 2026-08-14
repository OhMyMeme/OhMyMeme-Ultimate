export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '分组名不能为空' })
  }

  const exists = await GroupSchema.findOne({ name })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: '分组已存在' })
  }

  const group = await GroupSchema.create({ name })
  broadcastRealtime('groups-changed')
  return toGroup(group, 0)
})
