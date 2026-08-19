<script setup lang="ts">
import { computed } from "vue";
import type { Stat } from "../types";
import { useApi } from "../composables/useApi";

const { getOverview } = useApi();

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

let overview = { memeCount: 0, favoriteCount: 0, groupCount: 0, storageBytes: 0 };
try {
  overview = await getOverview();
} catch (error) {
  console.error("[dashboard] 加载总览失败", error);
}

const stats = computed<Stat[]>(() => [{
  title: "表情总数",
  icon: "i-lucide-image",
  value: overview.memeCount
}, {
  title: "收藏数",
  icon: "i-lucide-star",
  value: overview.favoriteCount
}, {
  title: "分组数",
  icon: "i-lucide-folder",
  value: overview.groupCount
}, {
  title: "存储占用",
  icon: "i-lucide-hard-drive",
  value: formatStorage(overview.storageBytes)
}]);
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="总览" :toggle="false" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarToggle class="desktop-sidebar-toggle" />
          <UDashboardSidebarCollapse class="desktop-sidebar-collapse" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
        <UPageCard
          v-for="(stat, index) in stats"
          :key="index"
          :icon="stat.icon"
          :title="stat.title"
          to="/memes"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
            title: 'font-normal text-muted text-xs uppercase'
          }"
          class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
        >
          <span class="text-2xl font-semibold text-highlighted">
            {{ stat.value }}
          </span>
        </UPageCard>
      </UPageGrid>
    </template>
  </UDashboardPanel>
</template>
