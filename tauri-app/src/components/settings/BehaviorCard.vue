<script setup lang="ts">
import { useSettings } from "../../composables/useSettings";

const { copyToast, copyPngFallback, gifAnimation, toastSpeed } = useSettings();

const toastSpeedOptions = [
  { value: "fast", label: "快" },
  { value: "normal", label: "标准" },
  { value: "slow", label: "慢" }
] as const;
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

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-highlighted">
            提示显示时长
          </p>
          <p class="text-xs text-muted">
            快 1 秒 / 标准 1.5 秒 / 慢 3 秒
          </p>
        </div>
        <UButtonGroup>
          <UButton
            v-for="option in toastSpeedOptions"
            :key="option.value"
            :label="option.label"
            color="neutral"
            :variant="toastSpeed === option.value ? 'solid' : 'outline'"
            @click="toastSpeed = option.value"
          />
        </UButtonGroup>
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

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            GIF 动画预览
          </p>
          <p class="text-xs text-muted">
            开启后网格直接加载 GIF 原图并保持动画；关闭后使用静态首帧，节省流量
          </p>
        </div>
        <USwitch v-model="gifAnimation" />
      </div>
    </div>
  </UCard>
</template>
