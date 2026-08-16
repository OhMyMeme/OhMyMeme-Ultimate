<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { useSettings } from "../../composables/useSettings";

const colorMode = useColorMode();
const { uiScale } = useSettings();

const themeOptions = [
  { value: "light", label: "浅色", icon: "i-lucide-sun" },
  { value: "dark", label: "深色", icon: "i-lucide-moon" },
  { value: "auto", label: "跟随系统", icon: "i-lucide-monitor" }
] as const;

const scaleOptions = [
  { value: "auto", label: "自动" },
  { value: "100", label: "100%" },
  { value: "115", label: "115%" },
  { value: "130", label: "130%" }
] as const;
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-palette" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          外观
        </h3>
      </div>
    </template>

    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-highlighted">
            主题
          </p>
          <p class="text-xs text-muted">
            界面明暗风格
          </p>
        </div>
        <UButtonGroup>
          <UButton
            v-for="option in themeOptions"
            :key="option.value"
            :label="option.label"
            :icon="option.icon"
            color="neutral"
            :variant="colorMode === option.value ? 'solid' : 'outline'"
            @click="colorMode = option.value"
          />
        </UButtonGroup>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-highlighted">
            界面缩放
          </p>
          <p class="text-xs text-muted">
            自动会随窗口大小调整
          </p>
        </div>
        <UButtonGroup>
          <UButton
            v-for="option in scaleOptions"
            :key="option.value"
            :label="option.label"
            color="neutral"
            :variant="uiScale === option.value ? 'solid' : 'outline'"
            @click="uiScale = option.value"
          />
        </UButtonGroup>
      </div>
    </div>
  </UCard>
</template>
