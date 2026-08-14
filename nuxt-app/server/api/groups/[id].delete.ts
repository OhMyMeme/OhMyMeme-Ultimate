export default defineEventHandler(async (event) => {
  const id = requireValidId(getRouterParam(event, 'id'))

  const group = await GroupSchema.findById(id)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: '分组不存在' })
  }

  const count = await MemeSchema.countDocuments({ groupId: id })
  if (count > 0) {
    throw createError({ statusCode: 409, statusMessage: '该分组下还有表情，请先移动或删除' })
  }

  await group.deleteOne()
  return { ok: true }
})
