<script setup lang="ts">
import { ref, watch } from "vue";
import type { Meme } from "../types";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useMemes } from "../composables/useMemes";

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ meme: Meme }>()

const { updateMeme } = useMemes()
const { pending, run } = useAsyncAction()

const draft = ref<string[]>([])
const input = ref("")

const MAX_TAGS = 20

watch(open, (value) => {
  if (value) {
    draft.value = [...props.meme.tags]
    input.value = ""
  }
})

function addTag() {
  const tag = input.value.trim()
  if (!tag) {
    return
  }
  if (tag.length > 30) {
    // 后端也会截断，这里前端同样限制输入长度
    return
  }
  if (!draft.value.includes(tag) && draft.value.length < MAX_TAGS) {
    draft.value = [...draft.value, tag]
  }
  input.value = ""
}

function removeTag(index: number) {
  draft.value = draft.value.filter((_, i) => i !== index)
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
    addTag()
  }
}

async function onSubmit() {
  const tags = [...draft.value]
  const success = await run(() => updateMeme(props.meme.id, { tags }), {
    success: "标签已保存"
  })
  if (success) {
    open.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="`编辑标签`">
    <template #body>
      <div v-if="draft.length" class="mb-3 flex flex-wrap gap-1.5">
        <span
          v-for="(tag, index) in draft"
          :key="tag"
          class="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-xs text-highlighted ring-1 ring-default"
        >
          {{ tag }}
          <button
            type="button"
            class="text-muted transition-colors hover:text-error"
            :aria-label="`移除标签 ${tag}`"
            @click="removeTag(index)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </span>
      </div>
      <p v-else class="mb-3 text-sm text-muted">
        还没有标签，输入后回车添加
      </p>

      <UInput
        v-model="input"
        icon="i-lucide-tag"
        placeholder="输入标签后回车"
        :maxlength="30"
        class="w-full"
        @keydown="onInputKeydown"
      />
      <p class="mt-1 text-xs text-muted">
        支持交集筛选，最多 {{ MAX_TAGS }} 个
      </p>
    </template>

    <template #footer>
      <UButton
        label="取消"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        label="保存"
        color="primary"
        :loading="pending"
        @click="onSubmit"
      />
    </template>
  </AppModal>
</template>
