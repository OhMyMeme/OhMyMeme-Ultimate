<script setup lang="ts">
import { computed } from "vue";

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  title?: string
  dismissible?: boolean
  /** 是否可关闭（控制标题栏关闭按钮），默认 true；上传中等场景传 false */
  closeable?: boolean
  /** 弹窗宽度类，默认 16rem（256px，100% 缩放时 = 24px 边距 ×2 + 208px 内容区） */
  widthClass?: string
}>(), {
  dismissible: true,
  closeable: true,
  widthClass: 'w-64'
})

const modalUi = computed(() => ({
  content: `${props.widthClass} max-w-[calc(100vw-3rem)]`,
  header: 'flex items-center justify-between gap-2 border-b border-default px-6 py-3',
  body: 'px-6 py-4',
  footer: 'app-modal-footer flex items-center gap-2 border-t border-default px-6 py-3'
}))
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="dismissible"
    :title="title"
    :ui="modalUi"
  >
    <template #header>
      <h3 class="truncate text-sm font-semibold text-highlighted">
        {{ title }}
      </h3>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="closeable === false"
        aria-label="关闭"
        @click="open = false"
      />
    </template>
    <template #body>
      <slot name="body" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </UModal>
</template>

<style>
/* footer 按钮一左一右均分占满（取消居左、主操作居右），文字水平居中 */
.app-modal-footer > * {
  flex: 1 1 0%;
  justify-content: center;
}
</style>
