<script setup lang="ts">
import type { Meme } from '~/types'

const props = defineProps<{
  meme: Meme
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': []
}>()

const { copy } = useCopyMeme()

function onClick() {
  if (props.selectable) {
    emit('toggle-select')
  } else {
    copy(props.meme)
  }
}
</script>

<template>
  <div
    class="group relative cursor-pointer overflow-hidden rounded-xl border bg-elevated transition-colors"
    :class="selected ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/40'"
    @click="onClick"
  >
    <img
      :src="meme.url"
      :alt="meme.name"
      loading="lazy"
      class="aspect-square w-full object-cover"
    >

    <div class="flex items-center gap-2 p-2">
      <span class="min-w-0 flex-1 truncate text-xs text-muted">
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
      class="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100"
      @click.stop
    >
      <MemeActionsMenu :meme="meme" />
    </div>
  </div>
</template>
