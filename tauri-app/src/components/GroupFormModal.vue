<script setup lang="ts">
import { ref, watch } from "vue";
import type { MemeGroup } from "../types";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useMemes } from "../composables/useMemes";

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  mode: 'create' | 'rename'
  group?: MemeGroup
}>()

const { createGroup, renameGroup } = useMemes()
const { pending, run } = useAsyncAction()

const name = ref('')

watch(open, (value) => {
  if (value) {
    name.value = props.mode === 'rename' ? props.group?.name ?? '' : ''
  }
})

async function onSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    return
  }

  const isRename = props.mode === 'rename' && props.group
  const success = await run(
    () => isRename ? renameGroup(props.group!.id, trimmed) : createGroup(trimmed),
    { success: isRename ? '重命名成功' : '分组已创建' }
  )
  if (success) {
    open.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="props.mode === 'rename' ? '重命名分组' : '新建分组'">
    <template #body>
      <UFormField label="分组名称" required>
        <UInput v-model="name" placeholder="输入分组名称" class="w-full" />
      </UFormField>
    </template>

    <template #footer>
      <UButton
        label="取消"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        label="确定"
        color="primary"
        :loading="pending"
        :disabled="!name.trim()"
        @click="onSubmit"
      />
    </template>
  </AppModal>
</template>
