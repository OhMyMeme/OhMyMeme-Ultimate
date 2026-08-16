<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useIntersectionObserver, useMediaQuery } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import type { Meme, MemeListResponse } from "../../types";
import { useMemes } from "../../composables/useMemes";
import { useApi } from "../../composables/useApi";

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

const { getMemes } = useApi();

const state = ref<MemeListResponse>({ items: [], total: 0, limit: pageSize.value, offset: 0 });
const loading = ref(false);
const loadingMore = ref(false);

const hasMore = computed(() => state.value.items.length < state.value.total);

async function load(reset = false) {
  if (reset) {
    loading.value = true;
  }
  try {
    const offset = reset ? 0 : state.value.items.length;
    const data = await getMemes(groupId.value, pageSize.value, offset);
    state.value = { ...data, items: reset ? data.items : [...state.value.items, ...data.items] };
  } catch (error) {
    console.error("[memes] 加载表情失败", error);
  } finally {
    loading.value = false;
  }
}

watch(groupId, () => {
  state.value = { items: [], total: 0, limit: pageSize.value, offset: 0 };
  load(true);
});

watch(pageSize, () => {
  load(true);
});

watch(revision, () => {
  load(true);
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
</script>

<template>
  <UDashboardPanel id="group">
    <template #header>
      <UDashboardNavbar :title="group?.name ?? '分组'" :toggle="false" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse class="desktop-sidebar-collapse" />
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
          <UploadMemeButton v-if="!isReadOnly" />
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

        <div class="meme-grid grid grid-cols-4 gap-3 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
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
          <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-8 animate-spin" />
          <UIcon v-else name="i-lucide-image-off" class="size-8" />
        </div>
        <div v-if="!loading">
          <p class="text-sm font-medium text-highlighted">
            {{ isFavorites ? '还没有收藏的表情' : isRecent ? '还没有最近使用的表情' : '该分组暂无表情' }}
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ isFavorites ? '点击表情卡片左上角的星标即可收藏' : isRecent ? '点击表情复制后会自动出现在这里' : '点击右上角「上传表情」添加' }}
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
