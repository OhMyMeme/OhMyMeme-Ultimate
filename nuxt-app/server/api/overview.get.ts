const OVERVIEW_TTL = 5 * 1000

interface OverviewData {
  memeCount: number
  favoriteCount: number
  groupCount: number
  storageBytes: number
}

let cache: { value: OverviewData, expiresAt: number } | null = null

export default defineEventHandler(async (): Promise<OverviewData> => {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.value
  }

  const [memeCount, favoriteCount, groupCount, storage] = await Promise.all([
    MemeSchema.countDocuments(),
    MemeSchema.countDocuments({ favorite: true }),
    GroupSchema.countDocuments({ isFavorites: { $ne: true }, isRecent: { $ne: true }, isUngrouped: { $ne: true } }),
    MemeSchema.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$size' } } }
    ])
  ])

  const value: OverviewData = {
    memeCount,
    favoriteCount,
    groupCount,
    storageBytes: storage[0]?.total || 0
  }

  cache = { value, expiresAt: now + OVERVIEW_TTL }
  return value
})
