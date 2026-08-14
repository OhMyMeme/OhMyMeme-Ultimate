<script setup lang="ts">
import { useMemes } from "../../composables/useMemes";

const memes = useMemes();
const groups = memes.groups;
await memes.refresh();
</script>

<template>
  <UDashboardPanel id="memes">
    <template #header>
      <UDashboardNavbar title="表情库" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <CreateGroupButton />
          <UploadMemeButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="groups.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <GroupCoverCard
          v-for="group in groups"
          :key="group.id"
          :group="group"
        />
      </div>

      <div v-else class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-elevated text-dimmed">
          <UIcon name="i-lucide-image-off" class="size-8" />
        </div>
        <div>
          <p class="text-sm font-medium text-highlighted">
            表情库还是空的
          </p>
          <p class="mt-1 text-sm text-muted">
            点击右上角「新建分组」，再「上传表情」开始添加
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>