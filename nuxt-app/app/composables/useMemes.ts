import type { Meme, MemeGroup } from '~/types'

export async function useMemes() {
  const groups = useAsyncData<MemeGroup[]>('meme-groups', () => $fetch('/api/groups'))

  await groups

  const groupsList = computed(() => groups.data.value ?? [])

  function groupById(id: string) {
    return groupsList.value.find(group => group.id === id)
  }

  async function refresh() {
    await refreshNuxtData()
  }

  async function createGroup(name: string) {
    const group = await $fetch<MemeGroup>('/api/groups', { method: 'POST', body: { name } })
    await refresh()
    return group
  }

  async function renameGroup(id: string, name: string) {
    const group = await $fetch<MemeGroup>(`/api/groups/${id}`, { method: 'PATCH', body: { name } })
    await refresh()
    return group
  }

  async function deleteGroup(id: string) {
    await $fetch(`/api/groups/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function updateMeme(id: string, data: { name?: string, groupId?: string }) {
    const meme = await $fetch<Meme>(`/api/memes/${id}`, { method: 'PATCH', body: data })
    await refresh()
    return meme
  }

  async function deleteMeme(id: string) {
    await $fetch(`/api/memes/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function batchMemes(ids: string[], action: 'move' | 'delete', groupId?: string) {
    const result = await $fetch('/api/memes/batch', { method: 'POST', body: { ids, action, groupId } })
    await refresh()
    return result
  }

  return {
    groups: groupsList,
    groupById,
    refresh,
    createGroup,
    renameGroup,
    deleteGroup,
    updateMeme,
    deleteMeme,
    batchMemes
  }
}
