<script setup lang="ts">
import type { Meme, MemeListResponse } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const groupId = computed(() => String(route.params.group))

const isMobile = useMediaQuery('(max-width: 639px)')
const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)')
const isLarge = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)')
const isXl = useMediaQuery('(min-width: 1280px) and (max-width: 1535px)')

const pageSize = computed(() => {
  if (isMobile.value) {
    return 24
  }
  if (isTablet.value) {
    return 32
  }
  if (isLarge.value) {
    return 48
  }
  if (isXl.value) {
    return 60
  }
  return 72
})

const groupMemes = useAsyncData(
  `memes-group-${groupId.value}`,
  () => useRequestFetch()<MemeListResponse>(`/api/memes?group=${groupId.value}&limit=${pageSize.value}&offset=0`),
  { watch: [pageSize] }
)

const { groupById } = await useMemes()
await groupMemes

const group = computed(() => groupById(groupId.value))

if (!group.value) {
  throw createError({ statusCode: 404, statusMessage: '分组不存在' })
}

const items = ref<Meme[]>([])
const total = ref(0)
const loadingMore = ref(false)
const hasMore = computed(() => items.value.length < total.value)

function apply(data?: MemeListResponse | null) {
  items.value = data?.items ?? []
  total.value = data?.total ?? 0
}

apply(groupMemes.data.value)
watch(groupMemes.data, data => apply(data))

watch(groupId, () => {
  items.value = []
  total.value = 0
  groupMemes.refresh()
})

async function loadMore() {
  if (loadingMore.value || !hasMore.value) {
    return
  }
  loadingMore.value = true
  try {
    const data = await $fetch<MemeListResponse>(`/api/memes?group=${groupId.value}&limit=${pageSize.value}&offset=${items.value.length}`)
    items.value = [...items.value, ...data.items]
    total.value = data.total
  } finally {
    loadingMore.value = false
  }
}

const sentinel = ref<HTMLElement | null>(null)
useIntersectionObserver(sentinel, ([entry]) => {
  if (entry?.isIntersecting) {
    loadMore()
  }
})

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

        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
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
            label="全选已加载"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="selectAll"
          />
          <p class="text-xs text-muted">
            已选 {{ selected.size }} 个
          </p>
        </div>

        <p class="text-xs text-muted">
          已加载 {{ items.length }} / 共 {{ total }} 个表情
        </p>

        <div
          v-if="hasMore"
          ref="sentinel"
          class="flex items-center justify-center gap-2 py-4 text-xs text-muted"
        >
          <template v-if="loadingMore">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
            加载中…
          </template>
          <template v-else>
            上滑加载更多
          </template>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-elevated text-dimmed">
          <UIcon v-if="groupMemes.pending.value" name="i-lucide-loader-circle" class="size-8 animate-spin" />
          <UIcon v-else name="i-lucide-image-off" class="size-8" />
        </div>
        <div v-if="!groupMemes.pending.value">
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
