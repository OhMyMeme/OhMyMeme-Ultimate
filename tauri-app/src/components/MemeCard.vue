<script setup lang="ts">
import { computed } from "vue";
import type { Meme } from "../types";
import { useCopyMeme } from "../composables/useCopyMeme";
import { useServer } from "../composables/useServer";
import { useAuth } from "../composables/useAuth";
import { useSettings } from "../composables/useSettings";
import { useMemes } from "../composables/useMemes";
import { useAsyncAction } from "../composables/useAsyncAction";

const props = defineProps<{
  meme: Meme
  selectable?: boolean
  selected?: boolean
  /** 拖动排序模式：此时整卡可拖动，单击不再复制以免误触 */
  reorderable?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': []
}>()

const { resolveUrl } = useServer()
const { copy } = useCopyMeme()
const { authorizeUrl } = useAuth()
const { gifAnimation } = useSettings()
const { toggleFavorite } = useMemes()
const { pending: favoritePending, run } = useAsyncAction()

const src = computed(() => {
  const isGif = props.meme.mimeType === "image/gif";
  const preview = isGif && gifAnimation.value ? props.meme.url : (props.meme.thumbUrl || props.meme.url);
  return authorizeUrl(resolveUrl(preview));
});

function onClick() {
  if (props.reorderable) {
    // 拖动排序模式下不复制，避免拖完手一松就把表情复制走
    return
  }
  if (props.selectable) {
    emit('toggle-select')
  } else {
    copy(props.meme)
  }
}

/** 非拖动排序模式下彻底禁止原生拖拽，避免把图片拖出去粘贴到别处 */
function onRootDragStart(event: DragEvent) {
  if (!props.reorderable) {
    event.preventDefault();
    event.stopPropagation();
  }
}

async function onToggleFavorite() {
  await run(() => toggleFavorite(props.meme.id, !props.meme.favorite), {
    success: props.meme.favorite ? '已取消收藏' : '已收藏'
  })
}
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-xl border bg-elevated transition-colors"
    :class="[
      selected ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/40',
      reorderable ? 'cursor-grab select-none active:cursor-grabbing' : 'cursor-pointer'
    ]"
    :title="reorderable ? '拖动调整顺序' : '点击复制'"
    data-meme-card
    @click="onClick"
    @dragstart="onRootDragStart"
  >
    <img
      :src="src"
      :alt="meme.name"
      loading="lazy"
      draggable="false"
      class="aspect-square w-full object-cover select-none"
      @dragstart.prevent.stop
    >

    <div class="flex flex-col gap-1 p-2">
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
        {{ meme.name }}
      </span>
      <div v-if="meme.tags?.length" class="flex min-w-0 flex-wrap gap-1">
        <span
          v-for="tag in meme.tags.slice(0, 3)"
          :key="tag"
          class="truncate rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-default"
        >
          #{{ tag }}
        </span>
        <span v-if="meme.tags.length > 3" class="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-default">
          +{{ meme.tags.length - 3 }}
        </span>
      </div>
    </div>

    <div
      v-if="reorderable"
      class="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-1.5 opacity-60 transition-opacity group-hover:opacity-100"
    >
      <UIcon name="i-lucide-grip-horizontal" class="size-4 text-highlighted drop-shadow" />
    </div>

    <div v-if="selectable" class="absolute left-2 top-2">
      <div
        class="flex size-5 items-center justify-center rounded-full border transition-colors"
        :class="selected ? 'border-primary bg-primary text-white' : 'border-default bg-elevated/80 text-transparent'"
      >
        <UIcon name="i-lucide-check" class="size-3" />
      </div>
    </div>

    <div
      v-if="!selectable"
      class="absolute left-1.5 top-1.5"
      :title="meme.favorite ? '取消收藏' : '收藏'"
      @click.stop
    >
      <div
        class="transition-opacity"
        :class="meme.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      >
        <UButton
          icon="i-lucide-star"
          size="sm"
          :color="meme.favorite ? 'warning' : 'neutral'"
          variant="ghost"
          class="bg-elevated/80 backdrop-blur"
          :loading="favoritePending"
          @click="onToggleFavorite"
        />
      </div>
    </div>

    <div
      v-if="!selectable"
      class="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100"
      @click.stop
    >
      <MemeActionsMenu :meme="meme" />
    </div>
  </div>
</template>
