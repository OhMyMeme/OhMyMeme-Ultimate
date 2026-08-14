export default defineEventHandler(async () => {
  const [memeCount, groupCount, storage] = await Promise.all([
    MemeSchema.countDocuments(),
    GroupSchema.countDocuments(),
    MemeSchema.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$size' } } }
    ])
  ])

  return {
    memeCount,
    groupCount,
    storageBytes: storage[0]?.total || 0
  }
})
