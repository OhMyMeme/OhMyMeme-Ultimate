<script setup lang="ts">
import { useSettings } from "../../composables/useSettings";

const { copyToast, copyPngFallback } = useSettings();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-copy" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          复制行为
        </h3>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            复制成功提示
          </p>
          <p class="text-xs text-muted">
            复制表情后显示通知
          </p>
        </div>
        <USwitch v-model="copyToast" />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            PNG 回退
          </p>
          <p class="text-xs text-muted">
            剪贴板不支持原格式时自动转为 PNG
          </p>
        </div>
        <USwitch v-model="copyPngFallback" />
      </div>
    </div>
  </UCard>
</template>
