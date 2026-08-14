<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import type { MemeGroup } from "../types";
import { useServer } from "../composables/useServer";

const props = defineProps<{
  group: MemeGroup
}>();

const { resolveUrl } = useServer();
const router = useRouter();

const covers = computed(() => props.group.covers.slice(0, 4).map(url => resolveUrl(url)));

function open() {
  router.push(`/memes/${props.group.id}`);
}
</script>

<template>
  <div
    class="group relative block cursor-pointer overflow-hidden rounded-2xl border border-default bg-elevated transition-colors hover:border-primary/40"
    @click="open"
  >
    <div v-if="covers.length === 1" class="aspect-square">
      <img
        :src="covers[0]"
        :alt="group.name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
    </div>

    <div v-else-if="covers.length" class="grid aspect-square grid-cols-2 grid-rows-2">
      <img
        v-for="(url, index) in covers"
        :key="index"
        :src="url"
        :alt="group.name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
    </div>

    <div v-else class="flex aspect-square items-center justify-center">
      <UIcon name="i-lucide-image-off" class="size-8 text-dimmed" />
    </div>

    <div class="absolute inset-x-0 bottom-0 bg-black/60 p-3">
      <p class="truncate text-sm font-semibold text-white">
        {{ group.name }}
      </p>
      <p class="text-xs text-white/70">
        {{ group.count }} 个表情
      </p>
    </div>

    <div class="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" @click.stop>
      <GroupActionsMenu :group="group" />
    </div>
  </div>
</template>