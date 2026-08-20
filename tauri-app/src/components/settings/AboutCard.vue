<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";

const version = ref("");

onMounted(async () => {
  try {
    version.value = await getVersion();
  } catch {
    version.value = "开发模式";
  }
});
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-info" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          关于
        </h3>
      </div>
    </template>

    <div class="flex flex-col gap-2 text-sm">
      <div class="flex items-center justify-between gap-4">
        <span class="text-muted">应用</span>
        <span class="text-highlighted">
          OhMyMemeUltimate Desktop
        </span>
      </div>
      <div class="flex items-center justify-between gap-4">
        <span class="text-muted">版本</span>
        <span class="text-highlighted">
          {{ version }}
        </span>
      </div>
    </div>
  </UCard>
</template>
