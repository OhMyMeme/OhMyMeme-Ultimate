export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, message: '分组名不能为空' })
  }

  const current = await GroupSchema.findById(id)
  if (!current) {
    throw createError({ statusCode: 404, message: '分组不存在' })
  }
  if (isSystemGroup(current)) {
    throw createError({ statusCode: 403, message: '系统分组不可修改' })
  }
  if (SYSTEM_GROUP_NAMES.includes(name)) {
    throw createError({ statusCode: 409, message: '该分组名为系统保留名' })
  }

  const exists = await GroupSchema.findOne({ name, _id: { $ne: id } })
  if (exists) {
    throw createError({ statusCode: 409, message: '分组已存在' })
  }

  const group = await GroupSchema.findByIdAndUpdate(id, { name }, { returnDocument: 'after' }).lean()
  if (!group) {
    throw createError({ statusCode: 404, message: '分组不存在' })
  }

  broadcastRealtime('groups-changed')
  return toGroup(group, await getGroupCount(id))
})
