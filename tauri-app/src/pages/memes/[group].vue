<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDebounceFn, useIntersectionObserver, useMediaQuery } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import type { Meme, MemeListResponse, Tag } from "../../types";
import { useMemes } from "../../composables/useMemes";
import { useApi } from "../../composables/useApi";
import { useSettings } from "../../composables/useSettings";

const route = useRoute();
const router = useRouter();

const groupId = computed(() => String((route.params as { group: string }).group));

const isMobile = useMediaQuery("(max-width: 639px)");
const isTablet = useMediaQuery("(min-width: 640px) and (max-width: 1023px)");
const isLarge = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");
const isXl = useMediaQuery("(min-width: 1280px) and (max-width: 1535px)");

const pageSize = computed(() => {
  if (isMobile.value) {
    return 24;
  }
  if (isTablet.value) {
    return 32;
  }
  if (isLarge.value) {
    return 48;
  }
  if (isXl.value) {
    return 60;
  }
  return 72;
});

const memes = useMemes();
const { groupById, revision } = memes;
await memes.refresh();

const group = computed(() => groupById(groupId.value));

const isFavorites = computed(() => group.value?.isFavorites === true);
const isRecent = computed(() => group.value?.isRecent === true);
const isReadOnly = computed(() => isFavorites.value || isRecent.value);

if (!group.value) {
  router.replace("/memes");
}

const { getMemes, getTags, reorderMeme } = useApi();
const { dragSort } = useSettings();
const toast = useToast();

const searchInput = ref("")
const effectiveQuery = ref("")
const debouncedQuery = useDebounceFn((value: string) => {
  effectiveQuery.value = value.trim()
}, 300)

const selectedTags = ref<string[]>([])
const allTags = ref<Tag[]>([])

getTags().then((tags) => {
  allTags.value = tags
}).catch(() => {
  // 标签加载失败不影响主列表
})

const state = ref<MemeListResponse>({ items: [], total: 0, limit: pageSize.value, offset: 0 });
const loading = ref(false);
const loadingMore = ref(false);

const hasMore = computed(() => state.value.items.length < state.value.total);

const isFiltering = computed(() => Boolean(effectiveQuery.value || selectedTags.value.length));

async function load(reset = false) {
  if (reset) {
    loading.value = true;
  }
  try {
    const offset = reset ? 0 : state.value.items.length;
    const data = await getMemes(groupId.value, pageSize.value, offset, {
      q: effectiveQuery.value || undefined,
      tags: selectedTags.value.length ? selectedTags.value : undefined
    });
    state.value = { ...data, items: reset ? data.items : [...state.value.items, ...data.items] };
  } catch (error) {
    console.error("[memes] 加载表情失败", error);
  } finally {
    loading.value = false;
  }
}

watch(searchInput, (value) => {
  debouncedQuery(value)
})

watch([effectiveQuery, selectedTags], () => {
  state.value = { items: [], total: 0, limit: pageSize.value, offset: 0 };
  load(true);
})

function toggleTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag)
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
}

function clearFilters() {
  searchInput.value = ""
  effectiveQuery.value = ""
  selectedTags.value = []
}

watch(groupId, () => {
  state.value = { items: [], total: 0, limit: pageSize.value, offset: 0 };
  load(true);
});

watch(pageSize, () => {
  load(true);
});

watch(revision, () => {
  // 自己的拖动排序会触发服务端广播，此时不要重载列表，否则刚拖好的位置会闪一下
  if (suppressReload.value) {
    suppressReload.value = false;
    return;
  }
  load(true);
});

// 标签变更（增删标签/上传）后刷新标签聚合，保证筛选条实时反映
watch(revision, () => {
  getTags().then((tags) => {
    allTags.value = tags
  }).catch(() => {
    // 忽略
  })
});

await load(true);

const items = computed(() => state.value.items ?? []);
const total = computed(() => state.value.total ?? 0);

async function loadMore() {
  if (loadingMore.value || !hasMore.value) {
    return;
  }
  loadingMore.value = true;
  try {
    await load();
  } finally {
    loadingMore.value = false;
  }
}

const sentinel = ref<HTMLElement | null>(null);
useIntersectionObserver(sentinel, ([entry]) => {
  if (entry?.isIntersecting) {
    loadMore();
  }
});

const selecting = ref(false);
const selected = ref<Set<string>>(new Set());
const selectedIds = computed(() => [...selected.value]);

function toggleSelecting() {
  selecting.value = !selecting.value;
  selected.value = new Set();
  if (selecting.value) {
    // 进入批量选择时自动退出拖动排序，两者互斥
    dragSort.value = false;
  }
}

function toggleSelect(meme: Meme) {
  const next = new Set(selected.value);
  if (next.has(meme.id)) {
    next.delete(meme.id);
  } else {
    next.add(meme.id);
  }
  selected.value = next;
}

function selectAll() {
  selected.value = new Set(items.value.map(meme => meme.id));
}

function exitSelection() {
  selecting.value = false;
  selected.value = new Set();
}

// ---- 拖动排序 ----
// 仅在开关开启、非批量选择、非只读分组、且未处于搜索/标签筛选时可用；
// 筛选时列表是子集，拖动落点无法映射到真实顺序。
const suppressReload = ref(false);
const draggingId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

const canReorder = computed(() =>
  dragSort.value && !isReadOnly.value && !selecting.value && !isFiltering.value
);

/** 顶部操作栏快捷开关：与批量选择互斥，避免两种交互抢同一次点击 */
function toggleDragSort() {
  dragSort.value = !dragSort.value;
  if (dragSort.value) {
    exitSelection();
  }
  onDragEnd();
}

function onDragStart(meme: Meme, event: DragEvent) {
  if (!canReorder.value) {
    // 未开启拖动排序时不允许发起任何原生拖拽（否则图片会被拖出应用）
    event.preventDefault();
    return;
  }
  draggingId.value = meme.id;
  if (event.dataTransfer) {
    // 仅允许"移动"语义，不提供 copy/link，避免被外部应用当作图片接收
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";
    // 只写内部标识，不写 URL/文件，外部程序拿不到可粘贴的图片内容
    event.dataTransfer.setData("application/x-ohmymeme-meme", meme.id);
    // 拖拽预览用整张卡片，而不是浏览器默认的裸图片
    const card = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement>("[data-meme-card]")
      ?? (event.currentTarget as HTMLElement | null);
    if (card && event.dataTransfer.setDragImage) {
      const rect = card.getBoundingClientRect();
      event.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2);
    }
  }
}

function onDragOver(meme: Meme) {
  if (!canReorder.value || !draggingId.value || meme.id === draggingId.value) {
    return;
  }
  dragOverId.value = meme.id;
}

function onDragEnd() {
  draggingId.value = null;
  dragOverId.value = null;
}

async function onDrop(target: Meme | null) {
  const sourceId = draggingId.value;
  onDragEnd();
  if (!canReorder.value || !sourceId || target?.id === sourceId) {
    return;
  }

  const list = [...items.value];
  const from = list.findIndex(m => m.id === sourceId);
  if (from < 0) {
    return;
  }
  const [moved] = list.splice(from, 1);
  if (!moved) {
    return;
  }
  const to = target ? list.findIndex(m => m.id === target.id) : list.length;
  if (target && to < 0) {
    return;
  }
  list.splice(target ? to : list.length, 0, moved);

  const previous = items.value;
  // 乐观更新：先让界面立刻就位，失败再回滚
  state.value = { ...state.value, items: list };
  suppressReload.value = true;

  try {
    await reorderMeme(sourceId, target?.id);
  } catch (error) {
    state.value = { ...state.value, items: previous };
    suppressReload.value = false;
    toast.add({
      title: "排序失败",
      description: error instanceof Error ? error.message : String(error),
      color: "error"
    });
  }
}
</script>

<template>
  <UDashboardPanel id="group">
    <template #header>
      <UDashboardNavbar :title="group?.name ?? '分组'" :toggle="false" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarToggle class="desktop-sidebar-toggle" />
          <UDashboardSidebarCollapse class="desktop-sidebar-collapse" />
        </template>

        <template #right>
          <UButton
            v-if="!isReadOnly"
            :label="dragSort ? '完成排序' : '拖动排序'"
            :icon="dragSort ? 'i-lucide-check' : 'i-lucide-grip-horizontal'"
            :color="dragSort ? 'primary' : 'neutral'"
            :variant="dragSort ? 'solid' : 'outline'"
            size="sm"
            class="rounded-full"
            :ui="{ label: 'hidden sm:block' }"
            :title="dragSort ? '关闭拖动排序，恢复点击复制' : '开启拖动排序'"
            @click="toggleDragSort"
          />
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
          <UploadMemeButton v-if="!isReadOnly" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2">
        <UInput
          v-model="searchInput"
          icon="i-lucide-search"
          placeholder="搜索名称或标签（在当前分组内）"
          class="w-full"
        >
          <template #trailing>
            <button
              v-if="searchInput"
              type="button"
              class="text-muted transition-colors hover:text-highlighted"
              aria-label="清除搜索"
              @click="searchInput = ''"
            >
              <UIcon name="i-lucide-x" class="size-4" />
            </button>
          </template>
        </UInput>
        <div v-if="allTags.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs text-muted">标签：</span>
          <button
            v-for="tag in allTags"
            :key="tag.name"
            type="button"
            class="rounded-full px-2.5 py-1 text-xs ring-1 transition-colors"
            :class="selectedTags.includes(tag.name)
              ? 'bg-primary text-white ring-primary'
              : 'bg-elevated text-muted ring-default hover:text-highlighted'"
            @click="toggleTag(tag.name)"
          >
            #{{ tag.name }}
            <span class="opacity-70">({{ tag.count }})</span>
          </button>
          <UButton
            v-if="selectedTags.length || effectiveQuery"
            label="清除筛选"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="clearFilters"
          />
        </div>
      </div>

      <div v-if="items.length" class="flex flex-col gap-4">
        <BatchActionBar
          v-if="selecting"
          :ids="selectedIds"
          @done="exitSelection"
          @cancel="exitSelection"
        />

        <div
          v-if="canReorder"
          class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 text-xs text-muted ring-1 ring-default"
        >
          <UIcon name="i-lucide-grip-horizontal" class="size-4 shrink-0" />
          <span>拖动排序已开启：按住表情拖到目标位置即可调整顺序，顺序会自动保存。此模式下单击不会复制。</span>
        </div>
        <div
          v-else-if="dragSort && !isReadOnly && isFiltering"
          class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 text-xs text-muted ring-1 ring-default"
        >
          <UIcon name="i-lucide-info" class="size-4 shrink-0" />
          <span>筛选状态下无法拖动排序，请先清除搜索与标签筛选。</span>
        </div>

        <div class="meme-grid grid grid-cols-4 gap-3 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
          <MemeCard
            v-for="meme in items"
            :key="meme.id"
            :meme="meme"
            :selectable="selecting"
            :selected="selected.has(meme.id)"
            :reorderable="canReorder"
            :draggable="canReorder"
            class="transition-opacity"
            :class="[
              draggingId === meme.id ? 'opacity-40' : '',
              dragOverId === meme.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : ''
            ]"
            @toggle-select="toggleSelect(meme)"
            @dragstart="onDragStart(meme, $event)"
            @dragover.prevent="onDragOver(meme)"
            @drop.prevent="onDrop(meme)"
            @dragend="onDragEnd"
          />
          <div
            v-if="canReorder"
            class="flex min-h-16 items-center justify-center rounded-xl border border-dashed border-default text-[10px] text-dimmed transition-colors"
            :class="dragOverId === '__end__' ? 'border-primary text-primary' : ''"
            @dragover.prevent="dragOverId = '__end__'"
            @drop.prevent="onDrop(null)"
          >
            移到末尾
          </div>
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
          <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-8 animate-spin" />
          <UIcon v-else-if="isFiltering" name="i-lucide-search-x" class="size-8" />
          <UIcon v-else name="i-lucide-image-off" class="size-8" />
        </div>
        <div v-if="!loading">
          <p v-if="isFiltering" class="text-sm font-medium text-highlighted">
            没有匹配的表情
          </p>
          <p v-else class="text-sm font-medium text-highlighted">
            {{ isFavorites ? '还没有收藏的表情' : isRecent ? '还没有最近使用的表情' : '该分组暂无表情' }}
          </p>
          <p v-if="isFiltering" class="mt-1 text-sm text-muted">
            试试更换关键词或减少标签筛选
          </p>
          <p v-else class="mt-1 text-sm text-muted">
            {{ isFavorites ? '点击表情卡片左上角的星标即可收藏' : isRecent ? '点击表情复制后会自动出现在这里' : '点击右上角「上传表情」添加' }}
          </p>
          <UButton
            v-if="isFiltering"
            label="清除筛选"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            size="sm"
            class="mt-2"
            @click="clearFilters"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
