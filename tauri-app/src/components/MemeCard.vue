<script setup lang="ts">
import { computed } from "vue";
import type { Meme } from "../types";
import { useCopyMeme } from "../composables/useCopyMeme";
import { useServer } from "../composables/useServer";
import { useAuth } from "../composables/useAuth";
import { useMemes } from "../composables/useMemes";
import { useAsyncAction } from "../composables/useAsyncAction";

const props = defineProps<{
  meme: Meme
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': []
}>()

const { resolveUrl } = useServer()
const { copy } = useCopyMeme()
const { authorizeUrl } = useAuth()
const { toggleFavorite } = useMemes()
const { pending: favoritePending, run } = useAsyncAction()

const src = computed(() => {
  const preview = props.meme.mimeType === "image/gif" ? props.meme.url : (props.meme.thumbUrl || props.meme.url);
  return authorizeUrl(resolveUrl(preview));
});

function onClick() {
  if (props.selectable) {
    emit('toggle-select')
  } else {
    copy(props.meme)
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
    class="group relative cursor-pointer overflow-hidden rounded-xl border bg-elevated transition-colors"
    :class="selected ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/40'"
    title="点击复制"
    @click="onClick"
  >
    <img
      :src="src"
      :alt="meme.name"
      loading="lazy"
      class="aspect-square w-full object-cover"
    >

    <div class="flex items-center gap-2 p-2">
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
        {{ meme.name }}
      </span>
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
