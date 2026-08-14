<script setup lang="ts">
import type { Meme, MemeListResponse } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const groupId = computed(() => String(route.params.group))
const page = ref(1)

const isMobile = useMediaQuery('(max-width: 639px)')
const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)')

const pageSize = computed(() => {
  if (isMobile.value) {
    return 24
  }
  if (isTablet.value) {
    return 32
  }
  return 48
})

watch(pageSize, () => {
  page.value = 1
})

const groupMemes = useAsyncData(
  `memes-group-${groupId.value}`,
  () => useRequestFetch()<MemeListResponse>(`/api/memes?group=${groupId.value}&limit=${pageSize.value}&offset=${(page.value - 1) * pageSize.value}`),
  { watch: [page, pageSize] }
)

const { groupById } = await useMemes()
await groupMemes

const group = computed(() => groupById(groupId.value))

if (!group.value) {
  throw createError({ statusCode: 404, statusMessage: '分组不存在' })
}

const items = computed(() => groupMemes.data.value?.items ?? [])
const total = computed(() => groupMemes.data.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const selecting = ref(false)
const selected = ref<Set<string>>(new Set())
const selectedIds = computed(() => [...selected.value])

function toggleSelecting() {
  selecting.value = !selecting.value
  selected.value = new Set()
}

function toggleSelect(meme: Meme) {
  const next = new Set(selected.value)
  if (next.has(meme.id)) {
    next.delete(meme.id)
  } else {
    next.add(meme.id)
  }
  selected.value = next
}

function selectAll() {
  selected.value = new Set(items.value.map(meme => meme.id))
}

function exitSelection() {
  selecting.value = false
  selected.value = new Set()
}
</script>

<template>
  <UDashboardPanel id="group">
    <template #header>
      <UDashboardNavbar :title="group?.name ?? '分组'" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarToggle />
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            :label="selecting ? '退出批量' : '批量选择'"
            :icon="selecting ? 'i-lucide-x' : 'i-lucide-list-checks'"
            color="neutral"
            variant="outline"
            size="sm"
            class="rounded-full"
            :ui="{ label: 'hidden sm:block' }"
            @click="toggleSelecting"
          />
          <UploadMemeButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="items.length" class="flex flex-col gap-4">
        <BatchActionBar
          v-if="selecting"
          :ids="selectedIds"
          @done="exitSelection"
          @cancel="exitSelection"
        />

        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
          <MemeCard
            v-for="meme in items"
            :key="meme.id"
            :meme="meme"
            :selectable="selecting"
            :selected="selected.has(meme.id)"
            @toggle-select="toggleSelect(meme)"
          />
        </div>

        <div v-if="selecting" class="flex items-center justify-between">
          <UButton
            label="全选本页"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="selectAll"
          />
          <p class="text-xs text-muted">
            已选 {{ selected.size }} 个
          </p>
        </div>

        <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted">
            共 {{ total }} 个表情
          </p>
          <UPagination
            v-if="pageCount > 1"
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
            :sibling-count="isMobile ? 0 : 1"
            size="xs"
            class="self-center sm:self-auto"
          />
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-elevated text-dimmed">
          <UIcon name="i-lucide-image-off" class="size-8" />
        </div>
        <div>
          <p class="text-sm font-medium text-highlighted">
            该分组暂无表情
          </p>
          <p class="mt-1 text-sm text-muted">
            点击右上角「上传表情」添加
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
