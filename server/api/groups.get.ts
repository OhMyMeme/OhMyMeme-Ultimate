export default defineEventHandler(async () => {
  const [groups, stats] = await Promise.all([
    GroupSchema.find().sort({ createdAt: 1 }).lean(),
    MemeSchema.aggregate<{ _id: unknown, count: number, keys: unknown[] }>([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$groupId',
          count: { $sum: 1 },
          keys: { $push: '$_id' }
        }
      },
      { $project: { count: 1, keys: { $slice: ['$keys', 4] } } }
    ])
  ])

  const statMap = new Map(stats.map(s => [String(s._id), s]))

  return groups.map((group) => {
    const stat = statMap.get(String(group._id))
    return toGroup(group, stat?.count ?? 0, stat?.keys ?? [])
  })
})
