<script setup lang="ts">
const props = defineProps<{ ids: string[] }>()

const emit = defineEmits<{
  done: []
  cancel: []
}>()

const { groups, batchMemes } = await useMemes()
const { pending, run } = useAsyncAction()

const moveOpen = ref(false)
const deleteOpen = ref(false)
const targetGroupId = ref('')

const groupOptions = computed(() => groups.value.map(group => ({ label: group.name, value: group.id })))

watch(moveOpen, (value) => {
  if (value) {
    targetGroupId.value = groupOptions.value[0]?.value ?? ''
  }
})

async function onMove() {
  if (!targetGroupId.value || !props.ids.length) {
    return
  }
  if (await run(() => batchMemes(props.ids, 'move', targetGroupId.value), {
    success: '已移动',
    description: `移动 ${props.ids.length} 个表情`
  })) {
    moveOpen.value = false
    emit('done')
  }
}

async function onDelete() {
  if (!props.ids.length) {
    return
  }
  if (await run(() => batchMemes(props.ids, 'delete'), {
    success: '已删除',
    description: `删除 ${props.ids.length} 个表情`
  })) {
    deleteOpen.value = false
    emit('done')
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-elevated px-4 py-3">
    <div class="flex items-center gap-2">
      <p class="text-sm text-highlighted">
        已选 {{ ids.length }} 个表情
      </p>
      <UButton
        label="移动"
        icon="i-lucide-arrow-right-left"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="!ids.length"
        @click="moveOpen = true"
      />
      <UButton
        label="删除"
        icon="i-lucide-trash"
        color="error"
        variant="outline"
        size="sm"
        :disabled="!ids.length"
        @click="deleteOpen = true"
      />
    </div>

    <UButton
      label="取消选择"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="emit('cancel')"
    />
  </div>

  <UModal v-model:open="moveOpen" title="批量移动">
    <template #body>
      <UFormField v-if="groupOptions.length" label="移动到分组">
        <USelectMenu
          v-model="targetGroupId"
          value-key="value"
          label-key="label"
          :items="groupOptions"
        />
      </UFormField>
      <p v-else class="text-sm text-muted">
        暂无其他分组可移动
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="moveOpen = false"
        />
        <UButton
          label="移动"
          color="primary"
          :loading="pending"
          :disabled="!targetGroupId"
          @click="onMove"
        />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="deleteOpen" title="批量删除">
    <template #body>
      <p class="text-sm text-muted">
        确定删除选中的 {{ ids.length }} 个表情吗？此操作不可恢复。
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="deleteOpen = false"
        />
        <UButton
          label="删除"
          color="error"
          :loading="pending"
          @click="onDelete"
        />
      </div>
    </template>
  </UModal>
</template>
