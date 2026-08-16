import { RECENT_LIMIT } from '../utils/group'

export default defineEventHandler(async () => {
  await ensureSystemGroups()

  const [groups, stats, favStats, recentStats] = await Promise.all([
    GroupSchema.find().lean(),
    MemeSchema.aggregate<{ _id: unknown, count: number, keys: unknown[] }>([
      {
        $group: {
          _id: '$groupId',
          count: { $sum: 1 },
          keys: { $topN: { n: 4, sortBy: { createdAt: -1 }, output: '$_id' } }
        }
      }
    ]),
    MemeSchema.aggregate<{ _id: null, count: number, keys: unknown[] }>([
      { $match: { favorite: true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          keys: { $topN: { n: 4, sortBy: { createdAt: -1 }, output: '$_id' } }
        }
      }
    ]),
    MemeSchema.aggregate<{ _id: null, count: number, keys: unknown[] }>([
      { $match: { usedAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          keys: { $topN: { n: 4, sortBy: { usedAt: -1 }, output: '$_id' } }
        }
      }
    ])
  ])

  const statMap = new Map(stats.map(s => [String(s._id), s]))
  const favStat = favStats[0]
  const recentStat = recentStats[0]

  return groups
    .sort((a, b) => {
      const diff = groupOrderRank(a) - groupOrderRank(b)
      if (diff !== 0) {
        return diff
      }
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    })
    .map((group) => {
      if (group.isFavorites) {
        return toGroup(group, favStat?.count ?? 0, favStat?.keys ?? [])
      }
      if (group.isRecent) {
        return toGroup(group, Math.min(recentStat?.count ?? 0, RECENT_LIMIT), recentStat?.keys ?? [])
      }
      const stat = statMap.get(String(group._id))
      return toGroup(group, stat?.count ?? 0, stat?.keys ?? [])
    })
})
