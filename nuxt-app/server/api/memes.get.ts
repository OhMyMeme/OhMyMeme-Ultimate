export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const groupId = isValidId(query.group) ? query.group : undefined
  const limit = Math.min(Math.max(Number(query.limit) || 48, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const filter = groupId ? { groupId } : {}

  const [docs, total] = await Promise.all([
    MemeSchema.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    MemeSchema.countDocuments(filter)
  ])

  return { items: docs.map(toMeme), total, limit, offset }
})
