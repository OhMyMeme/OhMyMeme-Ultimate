<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Meme, MemeListResponse } from "../../types";
import { useMemes } from "../../composables/useMemes";
import { useApi } from "../../composables/useApi";

const route = useRoute();
const router = useRouter();

const groupId = computed(() => String((route.params as { group: string }).group));
const page = ref(1);
const pageSize = 48;

const memes = useMemes();
const { groupById, revision } = memes;
await memes.refresh();

const group = computed(() => groupById(groupId.value));

if (!group.value) {
  router.replace("/memes");
}

const { getMemes } = useApi();

const state = ref<MemeListResponse>({ items: [], total: 0, limit: pageSize, offset: 0 });
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    state.value = await getMemes(groupId.value, pageSize, (page.value - 1) * pageSize);
  } finally {
    loading.value = false;
  }
}

watch(groupId, () => {
  page.value = 1;
});

watch([groupId, page], load);

watch(revision, () => {
  load();
});

await load();

const items = computed(() => state.value.items ?? []);
const total = computed(() => state.value.total ?? 0);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

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
      <UDashboardNavbar :title="group?.name ?? '分组'" :ui="{ right: 'gap-3' }">
        <template #leading>
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

        <div class="flex items-center justify-between gap-4 pt-2">
          <p class="text-xs text-muted">
            共 {{ total }} 个表情
          </p>
          <UPagination
            v-if="pageCount > 1"
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
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
