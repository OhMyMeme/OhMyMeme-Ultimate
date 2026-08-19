<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { useSettings } from "../../composables/useSettings";
import { useTheme, PRIMARY_COLORS, NEUTRAL_COLORS } from "../../composables/useTheme";

const colorMode = useColorMode();
const { uiScale } = useSettings();
const { primary, neutral } = useTheme();

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

const primarySwatches: Record<string, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-400",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500"
};

const neutralSwatches: Record<string, string> = {
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  zinc: "bg-zinc-500",
  neutral: "bg-neutral-500",
  stone: "bg-stone-500"
};
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
            主题色
          </p>
          <p class="text-xs text-muted">
            主按钮与强调色，仅限官方色板
          </p>
        </div>
        <div class="flex max-w-xs flex-wrap gap-1.5">
          <button
            v-for="color in PRIMARY_COLORS"
            :key="color"
            type="button"
            class="size-7 rounded-full transition-transform hover:scale-110"
            :class="[
              primarySwatches[color],
              primary === color ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-bg' : 'ring-1 ring-default'
            ]"
            :title="color"
            :aria-label="`主题色 ${color}`"
            @click="primary = color"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-highlighted">
            中性色
          </p>
          <p class="text-xs text-muted">
            页面与面板的底色基调
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="color in NEUTRAL_COLORS"
            :key="color"
            type="button"
            class="size-7 rounded-full transition-transform hover:scale-110"
            :class="[
              neutralSwatches[color],
              neutral === color ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-bg' : 'ring-1 ring-default'
            ]"
            :title="color"
            :aria-label="`中性色 ${color}`"
            @click="neutral = color"
          />
        </div>
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
