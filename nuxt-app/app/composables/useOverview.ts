import type { Stat } from '~/types'

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export async function useOverview() {
  const overview = useAsyncData('overview', () => useRequestFetch()<{
    memeCount: number
    groupCount: number
    storageBytes: number
  }>('/api/overview'))

  await overview

  const stats = computed<Stat[]>(() => {
    const data = overview.data.value
    if (!data) {
      return []
    }
    return [{
      title: '表情总数',
      icon: 'i-lucide-image',
      value: data.memeCount
    }, {
      title: '分组数',
      icon: 'i-lucide-folder',
      value: data.groupCount
    }, {
      title: '存储占用',
      icon: 'i-lucide-hard-drive',
      value: formatStorage(data.storageBytes)
    }]
  })

  return { stats, refresh: overview.refresh }
}
