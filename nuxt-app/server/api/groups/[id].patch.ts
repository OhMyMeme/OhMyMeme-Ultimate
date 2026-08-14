export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '分组名不能为空' })
  }

  const exists = await GroupSchema.findOne({ name, _id: { $ne: id } })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: '分组已存在' })
  }

  const group = await GroupSchema.findByIdAndUpdate(id, { name }, { returnDocument: 'after' }).lean()
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: '分组不存在' })
  }

  broadcastRealtime('groups-changed')
  return toGroup(group, await getGroupCount(id))
})
